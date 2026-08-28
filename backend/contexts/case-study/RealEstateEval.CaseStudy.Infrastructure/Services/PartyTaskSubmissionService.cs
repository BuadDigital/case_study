using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public partial class PartyTaskSubmissionService : IPartyTaskSubmissionService
{
 /// <summary>Party kinds that submit work through this service — everything but the parent.</summary>
    private static readonly HashSet<WorkflowTaskKind> AllowedKinds =
    [
        WorkflowTaskKind.EngineeringSurvey,
        WorkflowTaskKind.PropertyAppraisal,
        WorkflowTaskKind.FieldInspection,
    ];

 /// <summary>Case-specialist / supervisor inbox copy for a party's submit action, by task kind.</summary>
    private static readonly Dictionary<WorkflowTaskKind, (string Title, string Body)> SubmitNotificationText = new()
    {
        [WorkflowTaskKind.EngineeringSurvey] =
            ("إرسال الرفع المساحي", "أرسل المكتب الهندسي مخرجات الرفع المساحي للمراجعة"),
        [WorkflowTaskKind.FieldInspection] =
            ("إرسال المعاينة الميدانية", "أرسل المعاين بيانات المعاينة الميدانية للمراجعة"),
        [WorkflowTaskKind.PropertyAppraisal] =
            ("إرسال تقرير التقييم", "أرسل المقيم تقرير التقييم العقاري للمراجعة"),
    };

    private readonly ICaseStudyRepository _db;
    private readonly IFailureLookup _failureLookup;
    private readonly IWorkflowTaskService _tasks;
    private readonly IFieldInspectionAttachmentVerifier _fieldInspectionAttachments;
    private readonly IPropertyTimelineService _timeline;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IPermissionService _permissions;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public PartyTaskSubmissionService(
        ICaseStudyRepository db,
        IFailureLookup failureLookup,
        IWorkflowTaskService tasks,
        IFieldInspectionAttachmentVerifier fieldInspectionAttachments,
        IPropertyTimelineService timeline,
        IHttpContextAccessor httpContextAccessor,
        IPermissionService permissions,
        IInspectorFeeService inspectorFees,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _failureLookup = failureLookup;
        _tasks = tasks;
        _fieldInspectionAttachments = fieldInspectionAttachments;
        _timeline = timeline;
        _httpContextAccessor = httpContextAccessor;
        _permissions = permissions;
        _inspectorFees = inspectorFees;
        _notifications = notifications;
        _recipients = recipients;
    }

    public async Task<PartyTaskSubmissionDto?> GetAsync(
        Guid taskId,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !await CanReadTaskAsync(taskId, actor, cancellationToken))
            return null;

        var entity = await _db.PartyTaskSubmissions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);
        if (entity is not null)
            return await ToDtoAsync(entity, cancellationToken);

        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null || !AllowedKinds.Contains(task.Kind))
            return null;

        return await ToUnsavedDraftDtoAsync(task, cancellationToken);
    }

    public async Task<IReadOnlyList<PartyTaskSubmissionDto>> ListForTasksAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (workflowTaskIds.Count == 0) return [];

        var ids = workflowTaskIds.Distinct().Take(500).ToList();

        if (actor is not null && !PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
        {
            var readable = await ReadableTaskIdsAsync(ids, actor, cancellationToken);
            if (readable.Count == 0) return [];
            ids = readable;
        }

        var entities = await _db.PartyTaskSubmissions
            .AsNoTracking()
            .Where(s => ids.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);

 // أعلام معاينة الأشقاء دفعةً — كانت حتى استعلامين لكل إرسال (١٠٠٠ نداء لقائمة ٥٠٠).
        var flagsByTask = await LoadSiblingInspectionFlagsAsync(entities, cancellationToken);
        var result = new List<PartyTaskSubmissionDto>(entities.Count);
        foreach (var entity in entities)
        {
            var dto = ToDto(entity);
            ApplyInspectionFlags(dto, entity, flagsByTask);
            result.Add(dto);
        }
        return result;
    }

 /// <summary>نفس دلالة ToDtoAsync للأعلام — من قواميس محمّلة سلفاً.</summary>
    private static void ApplyInspectionFlags(
        PartyTaskSubmissionDto dto,
        PartyTaskSubmission entity,
        IReadOnlyDictionary<Guid, (bool Completed, bool Accepted)> flagsByTask)
    {
        var needsInspectionFlag =
            entity.Kind is WorkflowTaskKindValues.EngineeringSurvey
                or WorkflowTaskKindValues.PropertyAppraisal;
        if (!needsInspectionFlag) return;

        if (entity.PropertyId is not null
            && flagsByTask.TryGetValue(entity.WorkflowTaskId, out var flags))
        {
            dto.FieldInspectionCompleted = flags.Completed;
            if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
                dto.FieldInspectionAccepted = flags.Accepted;
            return;
        }

        dto.FieldInspectionCompleted = false;
        if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
            dto.FieldInspectionAccepted = false;
    }

    private async Task<Dictionary<Guid, (bool Completed, bool Accepted)>> LoadSiblingInspectionFlagsAsync(
        IReadOnlyList<PartyTaskSubmission> entities,
        CancellationToken cancellationToken)
    {
        var flags = new Dictionary<Guid, (bool Completed, bool Accepted)>();
        var targets = entities
            .Where(e =>
                e.Kind is WorkflowTaskKindValues.EngineeringSurvey
                    or WorkflowTaskKindValues.PropertyAppraisal
                && e.PropertyId is not null)
            .Select(e => (TaskId: e.WorkflowTaskId, PropertyId: e.PropertyId!.Value))
            .Distinct()
            .ToList();
        if (targets.Count == 0) return flags;

        var taskIds = targets.Select(t => t.TaskId).Distinct().ToList();
        var parentByTask = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .Select(t => new { t.Id, t.ParentTaskId })
            .ToDictionaryAsync(t => t.Id, t => t.ParentTaskId, cancellationToken);

        var parentIds = parentByTask.Values
            .Where(p => p is not null)
            .Select(p => p!.Value)
            .Distinct()
            .ToList();
        if (parentIds.Count == 0) return flags;

        var propertyIds = targets.Select(t => t.PropertyId).Distinct().ToList();
        var completedInspections = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.ParentTaskId != null
                && parentIds.Contains(t.ParentTaskId.Value)
                && t.PropertyId != null
                && propertyIds.Contains(t.PropertyId.Value)
                && t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status == WorkflowTaskStatus.Completed)
            .Select(t => new { t.Id, t.ParentTaskId, t.PropertyId })
            .ToListAsync(cancellationToken);

        var completedByPair = completedInspections
            .GroupBy(t => (Parent: t.ParentTaskId!.Value, Property: t.PropertyId!.Value))
            .ToDictionary(g => g.Key, g => g.Select(t => t.Id).ToList());

        var inspectionIds = completedInspections.Select(t => t.Id).ToList();
        var acceptedInspectionIds = inspectionIds.Count == 0
            ? []
            : (await _db.PartyTaskSubmissions.AsNoTracking()
                .Where(s =>
                    inspectionIds.Contains(s.WorkflowTaskId)
                    && s.AcceptedAtUtc != null)
                .Select(s => s.WorkflowTaskId)
                .ToListAsync(cancellationToken))
                .ToHashSet();

        foreach (var target in targets)
        {
            if (parentByTask.GetValueOrDefault(target.TaskId) is not Guid parent) continue;
            if (!completedByPair.TryGetValue((parent, target.PropertyId), out var siblings))
            {
                flags[target.TaskId] = (false, false);
                continue;
            }
            flags[target.TaskId] = (
                Completed: true,
                Accepted: siblings.Any(acceptedInspectionIds.Contains));
        }

        return flags;
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (!AllowedKinds.Contains(task.Kind))
            return (null, new Dictionary<string, string> { ["_"] = "نوع المهمة غير مدعوم" });

        if (actor is not null
            && !PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId))
        {
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية تعديل هذه المهمة" });
        }

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is not null && entity.Status is PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يمكن تعديل إرسال مُكتمل" });

        var now = _time.UtcNow();
        if (entity is null)
        {
            entity = PartyTaskSubmission.CreateDraft(
                taskId, task.Kind.ToDbValue(), task.PropertyId, task.PoNumber, now);
            _db.PartyTaskSubmissions.Add(entity);
        }

        var payloadJson = request.Payload.ValueKind == JsonValueKind.Undefined
            ? entity.PayloadJson
            : request.Payload.GetRawText();

        // B2: قواعد الانتقال داخل الجذر — الخدمة تُنسّق فقط.
        var draftError = entity.SaveDraft(
            payloadJson,
            PartyTaskSubmissionPayloadRules.ExtractStatus(payloadJson) ?? entity.Status,
            task.PropertyId,
            task.PoNumber,
            now);
        if (draftError is not null)
            return (null, new Dictionary<string, string> { ["_"] = draftError });

        if (task.Kind == WorkflowTaskKind.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SubmitAsync(
        Guid taskId,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (!AllowedKinds.Contains(task.Kind))
            return (null, new Dictionary<string, string> { ["_"] = "نوع المهمة غير مدعوم" });

        if (actor is not null
            && !PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId))
        {
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية إرسال هذه المهمة" });
        }

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد مسودة للإرسال" });

        if (entity.Status is PartyTaskSubmissionStatus.Submitted)
            return (await ToDtoAsync(entity, cancellationToken), null);

        var validationErrors = await ValidateForSubmitAsync(entity, cancellationToken);
        if (validationErrors.Count > 0)
            return (null, validationErrors);

        var now = _time.UtcNow();
        entity.Submit(now, actor?.UserId, actor?.DisplayName, task.AssigneeName);
        entity.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadStatus(entity.PayloadJson, PartyTaskSubmissionStatus.Submitted, now);

        if (entity.Kind == WorkflowTaskKindValues.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

 // Submission status and workflow completion must commit together; otherwise the
 // party looks submitted while the task is still open (or the reverse on rollback).
        await DbContextTransaction.ExecuteInTransactionAsync(
            _db,
            async ct =>
            {
                await _db.SaveChangesAsync(ct);
                await _tasks.PatchAsync(
                    taskId,
                    new PatchWorkflowTaskRequest
                    {
                        Status = WorkflowTaskStatusValues.Completed,
                        Phase = WorkflowTaskPhaseValues.Done,
                    },
                    ct);
            },
            cancellationToken);

        if (task.PropertyId is Guid propertyId)
        {
            var actorLabel = entity.SubmittedByName
                ?? (string.IsNullOrWhiteSpace(task.AssigneeName) ? null : task.AssigneeName);
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:submitted",
                WorkflowTaskKindLabels.SubmittedTitleAr(entity.Kind),
                actorLabel,
                "done",
                now,
                cancellationToken);
        }

        await NotifySpecialistAndSupervisorOnSubmitAsync(task, cancellationToken);
        if (task.Kind == WorkflowTaskKind.FieldInspection)
            await NotifySiblingSurveyInspectionSubmittedAsync(task, cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        ReopenPartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (task.Kind is not (WorkflowTaskKind.EngineeringSurvey
            or WorkflowTaskKind.PropertyAppraisal
            or WorkflowTaskKind.FieldInspection))
        {
            return (null, new Dictionary<string, string> { ["_"] = "إعادة الفتح غير مدعومة لهذا النوع" });
        }

        if (actor is not null && !PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية إعادة فتح إرسال الطرف" });

        var returnNote = request.ReturnNote?.Trim() ?? "";
        if ((task.Kind is WorkflowTaskKind.EngineeringSurvey
            or WorkflowTaskKind.FieldInspection
            or WorkflowTaskKind.PropertyAppraisal)
            && string.IsNullOrWhiteSpace(returnNote))
        {
            return (null, new Dictionary<string, string> { ["returnNote"] = "ملاحظة الإرجاع مطلوبة" });
        }

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مُكتمل لإعادته" });

        var now = _time.UtcNow();
        // B2: الإعادة تُبطل القبول داخل الجذر — الخدمة تُنسّق الحزمة والمهمة فقط.
        var returnError = entity.ReturnForCorrection(
            returnNote, now, actor?.UserId, actor?.DisplayName);
        if (returnError is not null)
            return (null, new Dictionary<string, string> { ["_"] = returnError });

        entity.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadReopened(entity.PayloadJson, returnNote, now);

        if (task.Kind == WorkflowTaskKind.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

 // Reopen the submission and reopen the workflow task in one transaction so a
 // mid-failure cannot leave a reopened submission still marked completed on the task.
        await DbContextTransaction.ExecuteInTransactionAsync(
            _db,
            async ct =>
            {
                await _db.SaveChangesAsync(ct);
                await _tasks.PatchAsync(
                    taskId,
                    new PatchWorkflowTaskRequest
                    {
                        Status = WorkflowTaskStatusValues.Open,
                        Phase = WorkflowTaskPhaseValues.Done,
                    },
                    ct);
            },
            cancellationToken);

        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
            await NotifyPartyAssigneeAsync(
                task,
                title: "إعادة الرفع المساحي للتصحيح",
                body: string.IsNullOrWhiteSpace(returnNote)
                    ? "أُعيدت مخرجات الرفع المساحي للتصحيح."
                    : $"أُعيدت مخرجات الرفع المساحي للتصحيح: {returnNote.Trim()}",
                tone: "warn",
                sourceEvent: $"engineering-survey-returned:{taskId}",
                href: $"/active-survey/{Uri.EscapeDataString(task.Id.ToString())}",
                cancellationToken);
        else if (task.Kind == WorkflowTaskKind.FieldInspection)
            await NotifyPartyAssigneeAsync(
                task,
                title: "إعادة المعاينة للتصحيح",
                body: string.IsNullOrWhiteSpace(returnNote)
                    ? "أُعيدت بيانات المعاينة للتصحيح."
                    : $"أُعيدت بيانات المعاينة للتصحيح: {returnNote.Trim()}",
                tone: "warn",
                sourceEvent: $"field-inspection-returned:{taskId}",
                href: $"/active-inspection/{Uri.EscapeDataString(task.Id.ToString())}",
                cancellationToken);
        else if (task.Kind == WorkflowTaskKind.PropertyAppraisal)
            await NotifyPartyAssigneeAsync(
                task,
                title: "إعادة التقييم للتصحيح",
                body: string.IsNullOrWhiteSpace(returnNote)
                    ? "أُعيد تقييم العقار للتصحيح."
                    : $"أُعيد تقييم العقار للتصحيح: {returnNote.Trim()}",
                tone: "warn",
                sourceEvent: $"property-appraisal-returned:{taskId}",
                href: $"/property-appraisal/{Uri.EscapeDataString(task.Id.ToString())}",
                cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (task.Kind is not (WorkflowTaskKind.EngineeringSurvey
            or WorkflowTaskKind.FieldInspection
            or WorkflowTaskKind.PropertyAppraisal))
            return (null, new Dictionary<string, string> { ["_"] = "قبول المخرجات غير متاح لهذا النوع من المهام" });

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية قبول مخرجات الطرف" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مكتمل لقبوله" });

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير مكتملة بعد" });

        var actorUserId = string.IsNullOrWhiteSpace(actor.UserId) ? "system" : actor.UserId;
        var alreadyAccepted = entity.AcceptedAtUtc is not null;

        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
        {
 // Fee accrual and acceptance timestamp must succeed or fail together.
            var feeError = await DbContextTransaction.ExecuteInTransactionAsync(
                _db,
                async ct =>
                {
                    var (_, error) = await _inspectorFees.AccrueEngineeringSurveyFeeAsync(
                        taskId,
                        actorUserId,
                        ct);
                    if (error is not null)
                        return (Commit: false, Result: error);

                    if (!alreadyAccepted)
                    {
                        _ = entity.Accept(_time.UtcNow(), actorUserId, actor.DisplayName);
                        await _db.SaveChangesAsync(ct);
                    }

                    return (Commit: true, Result: (string?)null);
                },
                cancellationToken);

            if (feeError is not null)
                return (null, new Dictionary<string, string> { ["_"] = feeError });
        }
        else if (!alreadyAccepted)
        {
 // Field inspection: إنفاذ package gate. Appraisal stamp is receive/acknowledge only.
            _ = entity.Accept(_time.UtcNow(), actorUserId, actor.DisplayName);
            await _db.SaveChangesAsync(cancellationToken);
        }

        var timelineTitle = task.Kind switch
        {
            WorkflowTaskKind.FieldInspection => "اعتماد بيانات المعاينة",
            WorkflowTaskKind.PropertyAppraisal => "استلام تقرير التقييم",
            _ => "قبول مخرجات الرفع المساحي",
        };

        if (task.PropertyId is Guid propertyId)
        {
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:accepted",
                timelineTitle,
                entity.AcceptedByName ?? task.AssigneeName,
                "done",
                _time.UtcNow(),
                cancellationToken);
        }

        if (!alreadyAccepted)
        {
            if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
            {
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "قبول مخرجات الرفع المساحي",
                    body: "تم قبول مخرجات الرفع المساحي واستحقاق الأتعاب.",
                    tone: "success",
                    sourceEvent: $"engineering-survey-accepted:{taskId}",
                    href: $"/active-survey/{Uri.EscapeDataString(task.Id.ToString())}",
                    cancellationToken);
            }
            else if (task.Kind == WorkflowTaskKind.FieldInspection)
            {
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "اعتماد بيانات المعاينة",
                    body: "اعتمد الأخصائي بيانات المعاينة. تظهر البيانات المعتمدة في حزمة الرفع على إنفاذ، ويمكن للمقيّم بدء التقييم.",
                    tone: "success",
                    sourceEvent: $"field-inspection-accepted:{taskId}",
                    href: $"/active-inspection/{Uri.EscapeDataString(task.Id.ToString())}",
                    cancellationToken);
                await NotifySiblingAppraiserInspectionAcceptedAsync(task, cancellationToken);
            }
            else if (task.Kind == WorkflowTaskKind.PropertyAppraisal)
            {
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "استلام تقرير التقييم",
                    body: "استلم الأخصائي تقرير التقييم. هذا إقرار بالاستلام وليس اعتماداً للقيمة — حزمة إنفاذ تتغذى من التقرير المُرسل.",
                    tone: "success",
                    sourceEvent: $"property-appraisal-accepted:{taskId}",
                    href: $"/property-appraisal/{Uri.EscapeDataString(task.Id.ToString())}",
                    cancellationToken);
            }
        }

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    // B2: ختم القبول انتقل إلى الجذر — PartyTaskSubmission.Accept.

    private async Task<Dictionary<string, string>> ValidateForSubmitAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var errors = PartyTaskSubmissionPayloadRules.ValidateForSubmit(entity);
        var documentary = await ValidateDocumentaryGatesAsync(entity, cancellationToken);
        foreach (var (key, message) in documentary)
            errors[key] = message;

        if (errors.Count > 0)
            return errors;

        try
        {
            using var doc = JsonDocument.Parse(entity.PayloadJson);
            if (entity.Kind == WorkflowTaskKindValues.FieldInspection)
            {
                var attachmentErrors = await _fieldInspectionAttachments.VerifyAsync(
                    entity.WorkflowTaskId,
                    doc.RootElement,
                    cancellationToken);
                foreach (var (key, message) in attachmentErrors)
                    errors[key] = message;
            }
        }
        catch
        {
            errors["_"] = "بيانات الإرسال غير صالحة";
        }

        return errors;
    }

    private async Task<Dictionary<string, string>> ValidateDocumentaryGatesAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string>();
        var bypass = await CurrentUserBypassesAsync(cancellationToken);

        WorkOrderProperty? property = null;
        if (entity.PropertyId is Guid propertyId)
        {
            property = await _db.WorkOrderProperties
                .AsNoTracking()
                .Include(p => p.Contacts)
                .Include(p => p.WorkOrder)
                .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        }

        var propertyIdStr = entity.PropertyId?.ToString() ?? "";
        var hasActiveFailure = await _failureLookup.HasActiveAsync(
            entity.PoNumber ?? "",
            propertyIdStr,
            cancellationToken);

        using var doc = JsonDocument.Parse(entity.PayloadJson);
        var root = doc.RootElement;

        switch (entity.Kind)
        {
            case WorkflowTaskKindValues.EngineeringSurvey:
            {
                var inspectionCompleted = entity.PropertyId is Guid pid
                    && await IsSiblingFieldInspectionCompletedAsync(
                        entity.WorkflowTaskId,
                        pid,
                        cancellationToken);

                var surveyBlock = DocumentaryWorkflowRules.SurveyWorkBlockReason(
                    bypass,
                    inspectionCompleted,
                    hasActiveFailure);
                if (surveyBlock is not null)
                    errors["_documentary"] = surveyBlock;

                PartyTaskSubmissionPayloadRules.RequireSiteLetterUnlessPlatted(
                    errors,
                    root,
                    property?.PlanNumber,
                    property?.PlotNumber);

                var hasPhone = property is not null
                    && DocumentaryWorkflowRules.HasAnyPartyPhone(property.Contacts);
                var phoneWasPresent = PartyTaskSubmissionPayloadRules.GetBool(root, "declarationPhoneSatisfied");
                var phoneBlock = DocumentaryWorkflowRules.DeclarationPhoneBlockReason(
                    bypass,
                    hasPhone,
                    phoneWasPresent);
                if (phoneBlock is not null
                    && (PartyTaskSubmissionPayloadRules.HasNonEmpty(root, "siteLetterFileName") || PartyTaskSubmissionPayloadRules.GetBool(root, "siteConfirmed")))
                {
                    errors["siteLetterFileName"] = phoneBlock;
                }
                break;
            }

            case WorkflowTaskKindValues.FieldInspection:
            {
 // Informal map-URL access gate removed — tasks are not assigned without initial data.
 // Key envelopes remain tracked (payload keyAvailable) but do not block submit.
                var hasPhone = property is not null
                    && DocumentaryWorkflowRules.HasAnyPartyPhone(property.Contacts);
                var phoneWasPresent = PartyTaskSubmissionPayloadRules.GetBool(root, "declarationPhoneSatisfied");
                var phoneBlock = DocumentaryWorkflowRules.DeclarationPhoneBlockReason(
                    bypass,
                    hasPhone,
                    phoneWasPresent);
                if (phoneBlock is not null && PartyTaskSubmissionPayloadRules.GetBool(root, "clientDeclarationSigned"))
                    errors["clientDeclarationSigned"] = phoneBlock;
                break;
            }
        }

        return errors;
    }

    private async Task<bool> CurrentUserBypassesAsync(CancellationToken cancellationToken)
    {
        var userId = ActorIdentity.TryUserId(_httpContextAccessor.HttpContext?.User);
        if (string.IsNullOrWhiteSpace(userId)) return false;
        var perms = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        return DocumentaryWorkflowRules.RoleBypassesDocumentaryGates(perms?.PrototypeRole);
    }

    private async Task SyncFieldInspectionWorkspaceAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        using var doc = JsonDocument.Parse(entity.PayloadJson);
        var projected = FieldInspectionWorkspaceProjector.Project(
            entity, doc.RootElement, _time.UtcNow());
        var existing = await _db.FieldInspectionWorkspaces
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == entity.WorkflowTaskId, cancellationToken);

        if (existing is null)
        {
            _db.FieldInspectionWorkspaces.Add(projected);
            return;
        }

        var createdAtUtc = existing.CreatedAtUtc;
        _db.Entry(existing).CurrentValues.SetValues(projected);
        existing.CreatedAtUtc = createdAtUtc;
    }

    private async Task<bool> IsSiblingFieldInspectionCompletedAsync(
        Guid partyTaskId,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var parentId = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Id == partyTaskId)
            .Select(t => t.ParentTaskId)
            .FirstOrDefaultAsync(cancellationToken);
        if (parentId is not Guid parentTaskId)
            return false;

        return await _db.WorkflowTasks.AsNoTracking().AnyAsync(
            t => t.ParentTaskId == parentTaskId
                && t.PropertyId == propertyId
                && t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status == WorkflowTaskStatus.Completed,
            cancellationToken);
    }

    private async Task<bool> IsSiblingFieldInspectionAcceptedAsync(
        Guid partyTaskId,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var parentId = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Id == partyTaskId)
            .Select(t => t.ParentTaskId)
            .FirstOrDefaultAsync(cancellationToken);
        if (parentId is not Guid parentTaskId)
            return false;

        var inspectionId = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId
                && t.PropertyId == propertyId
                && t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status == WorkflowTaskStatus.Completed)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (inspectionId is not Guid id)
            return false;

        return await _db.PartyTaskSubmissions.AsNoTracking().AnyAsync(
            s => s.WorkflowTaskId == id && s.AcceptedAtUtc != null,
            cancellationToken);
    }

    private async Task<PartyTaskSubmissionDto> ToUnsavedDraftDtoAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        var dto = await ToDtoAsync(
            new PartyTaskSubmission
            {
                Id = Guid.Empty,
                WorkflowTaskId = task.Id,
                Kind = task.Kind.ToDbValue(),
                Status = PartyTaskSubmissionStatus.Draft,
                PropertyId = task.PropertyId,
                PoNumber = task.PoNumber,
                PayloadJson = "{}",
            },
            cancellationToken);
        dto.Id = "";
        return dto;
    }

    private async Task<PartyTaskSubmissionDto> ToDtoAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var dto = ToDto(entity);
        var needsInspectionFlag =
            entity.Kind is WorkflowTaskKindValues.EngineeringSurvey
                or WorkflowTaskKindValues.PropertyAppraisal;
        if (needsInspectionFlag && entity.PropertyId is Guid propertyId)
        {
            dto.FieldInspectionCompleted = await IsSiblingFieldInspectionCompletedAsync(
                entity.WorkflowTaskId,
                propertyId,
                cancellationToken);
            if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
            {
                dto.FieldInspectionAccepted = await IsSiblingFieldInspectionAcceptedAsync(
                    entity.WorkflowTaskId,
                    propertyId,
                    cancellationToken);
            }
        }
        else if (needsInspectionFlag)
        {
            dto.FieldInspectionCompleted = false;
            if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
                dto.FieldInspectionAccepted = false;
        }

        return dto;
    }

    private static PartyTaskSubmissionDto ToDto(PartyTaskSubmission entity)
    {
        JsonElement payload;
        try
        {
            payload = JsonDocument.Parse(entity.PayloadJson).RootElement.Clone();
        }
        catch
        {
            payload = JsonDocument.Parse("{}").RootElement.Clone();
        }

        return new PartyTaskSubmissionDto
        {
            Id = entity.Id.ToString(),
            TaskId = entity.WorkflowTaskId.ToString(),
            Kind = entity.Kind,
            Status = entity.Status,
            PropertyId = entity.PropertyId?.ToString(),
            PoNumber = entity.PoNumber,
            Payload = payload,
            ReturnNote = entity.ReturnNote,
            SubmittedAtUtc = entity.SubmittedAtUtc?.ToString("O"),
            AcceptedAtUtc = entity.AcceptedAtUtc?.ToString("O"),
            SubmittedByUserId = entity.SubmittedByUserId,
            SubmittedByName = entity.SubmittedByName,
            AcceptedByUserId = entity.AcceptedByUserId,
            AcceptedByName = entity.AcceptedByName,
            ReopenedByUserId = entity.ReopenedByUserId,
            ReopenedByName = entity.ReopenedByName,
            UpdatedAtUtc = entity.UpdatedAtUtc.ToString("O"),
        };
    }
}
