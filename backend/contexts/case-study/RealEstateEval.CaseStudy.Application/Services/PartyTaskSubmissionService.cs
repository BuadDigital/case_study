using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Party task submission use case (engineering survey / field inspection / property
/// appraisal packages). Orchestrates the aggregate, the workflow task, timeline, fees, and
/// notifications through Application ports only; persistence is
/// <see cref="IPartyTaskSubmissionRepository"/>.
/// </summary>
public partial class PartyTaskSubmissionService : IPartyTaskSubmissionService
{
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

    private readonly IPartyTaskSubmissionRepository _repo;
    private readonly IPartyTaskFailureGate _failures;
    private readonly IWorkflowTaskService _tasks;
    private readonly IFieldInspectionAttachmentVerifier _fieldInspectionAttachments;
    private readonly IPropertyTimelineService _timeline;
    private readonly ICurrentPrototypeRoleResolver _currentRole;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly IAuditLogWriter _audit;
    private readonly IAuditLogAppend _auditLog;
    private readonly TimeProvider _time;

    public PartyTaskSubmissionService(
        IPartyTaskSubmissionRepository repo,
        IPartyTaskFailureGate failures,
        IWorkflowTaskService tasks,
        IFieldInspectionAttachmentVerifier fieldInspectionAttachments,
        IPropertyTimelineService timeline,
        ICurrentPrototypeRoleResolver currentRole,
        IInspectorFeeService inspectorFees,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        IAuditLogWriter audit,
        IAuditLogAppend auditLog,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repo;
        _failures = failures;
        _tasks = tasks;
        _fieldInspectionAttachments = fieldInspectionAttachments;
        _timeline = timeline;
        _currentRole = currentRole;
        _inspectorFees = inspectorFees;
        _notifications = notifications;
        _recipients = recipients;
        _audit = audit;
        _auditLog = auditLog;
    }

    private static Dictionary<string, string> Error(string message) => PartyTaskSubmissionRules.Error(message);

    public async Task<PartyTaskSubmissionDto?> GetAsync(
        Guid taskId,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !await CanReadTaskAsync(taskId, actor, cancellationToken))
            return null;

        var entity = await _repo.GetSubmissionAsync(taskId, track: false, cancellationToken);
        if (entity is not null)
            return await ToDtoAsync(entity, cancellationToken);

        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null || !PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
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

        var entities = await _repo.ListSubmissionsAsync(ids, cancellationToken);

        // Batch sibling preview flags — a bounded number of queries per list, not per row.
        var flagsByTask = await LoadSiblingInspectionFlagsAsync(entities, cancellationToken);
        var result = new List<PartyTaskSubmissionDto>(entities.Count);
        foreach (var entity in entities)
        {
            var dto = PartyTaskSubmissionRules.ToDto(entity);
            ApplyInspectionFlags(dto, entity, flagsByTask);
            result.Add(dto);
        }
        return result;
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
            return (null, Error("نوع المهمة غير مدعوم"));

        var canStaffCorrectFieldInspection =
            PartyTaskSubmissionRules.StaffMayCorrectFieldInspection(actor, task);
        if (!PartyTaskSubmissionRules.MayWriteDraft(actor, task, canStaffCorrectFieldInspection))
            return (null, Error("ليس لديك صلاحية تعديل هذه المهمة"));

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);

        var now = _time.UtcNow();
        if (entity is null)
        {
            entity = PartyTaskSubmission.CreateDraft(
                taskId, task.Kind.ToDbValue(), task.PropertyId, task.PoNumber, now);
            _repo.Add(entity);
        }

        var payloadJson = request.Payload.ValueKind == JsonValueKind.Undefined
            ? entity.PayloadJson
            : request.Payload.GetRawText();

        if (entity.Status is PartyTaskSubmissionStatus.Submitted)
        {
            if (!canStaffCorrectFieldInspection)
                return (null, Error("لا يمكن تعديل إرسال مُكتمل"));

            var submittedType =
                InspectedPropertyTypeRules.FromPayload(entity.PayloadJson);
            var correctedType =
                InspectedPropertyTypeRules.FromPayload(payloadJson);
            if (!string.Equals(
                    submittedType,
                    correctedType,
                    StringComparison.Ordinal))
            {
                return (null, new Dictionary<string, string>
                {
                    ["assetSubject"] =
                        "نوع العقار الميداني يملكه المعاين؛ أعد المهمة للتصحيح",
                });
            }

            // Keep package submitted while case staff corrects fields (map pin, etc.).
            payloadJson = PartyTaskSubmissionPayloadRules.SetPayloadStatus(
                payloadJson,
                PartyTaskSubmissionStatus.Submitted,
                entity.SubmittedAtUtc ?? now);
            var correctError = entity.CorrectSubmittedPayload(payloadJson, now);
            if (correctError is not null)
                return (null, Error(correctError));

            if (task.Kind == WorkflowTaskKind.FieldInspection)
                await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

            await _repo.SaveChangesAsync(cancellationToken);
            return (await ToDtoAsync(entity, cancellationToken), null);
        }

        // B2: Intra-root transition rules — service coordinates only.
        var draftError = entity.SaveDraft(
            payloadJson,
            PartyTaskSubmissionPayloadRules.ExtractStatus(payloadJson) ?? entity.Status,
            task.PropertyId,
            task.PoNumber,
            now);
        if (draftError is not null)
            return (null, Error(draftError));

        if (task.Kind == WorkflowTaskKind.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        await _repo.SaveChangesAsync(cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SubmitAsync(
        Guid taskId,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
            return (null, Error("نوع المهمة غير مدعوم"));

        if (actor is not null
            && !PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId))
        {
            return (null, Error("ليس لديك صلاحية إرسال هذه المهمة"));
        }

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null)
            return (null, Error("لا يوجد مسودة للإرسال"));

        if (entity.Status is PartyTaskSubmissionStatus.Submitted)
            return (await ToDtoAsync(entity, cancellationToken), null);

        string? inspectedPropertyType = null;
        if (task.Kind == WorkflowTaskKind.FieldInspection)
        {
            inspectedPropertyType = InspectedPropertyTypeRules.FromPayload(entity.PayloadJson);
            if (inspectedPropertyType is null)
            {
                return (null, new Dictionary<string, string>
                {
                    ["assetSubject"] = "الأصل محل التقييم مطلوب ويجب اختياره من القائمة",
                });
            }
            entity.PayloadJson = InspectedPropertyTypeRules.NormalizePayloadForSubmission(
                entity.PayloadJson,
                inspectedPropertyType);
        }

        var validationErrors = await ValidateForSubmitAsync(entity, cancellationToken);
        if (validationErrors.Count > 0)
            return (null, validationErrors);

        var now = _time.UtcNow();
        entity.Submit(now, actor?.UserId, actor?.DisplayName, task.AssigneeName);
        entity.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadStatus(
            entity.PayloadJson, PartyTaskSubmissionStatus.Submitted, now);

        if (entity.Kind == WorkflowTaskKindValues.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        // Submission status and workflow completion must commit together; otherwise the
        // party looks submitted while the task is still open (or the reverse on rollback).
        await _repo.ExecuteInTransactionAsync(
            async ct =>
            {
                if (task.PropertyId is Guid inspectedPropertyId
                    && inspectedPropertyType is not null)
                {
                    await _repo.SetInspectedPropertyTypeAsync(
                        inspectedPropertyId,
                        inspectedPropertyType,
                        InspectedPropertyTypeRules.IsLand(inspectedPropertyType),
                        ct);
                }
                await _repo.SaveChangesAsync(ct);
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
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:submitted",
                WorkflowTaskKindLabels.SubmittedTitleAr(entity.Kind),
                PartyTaskSubmissionRules.SubmittedActorLabel(entity, task),
                "done",
                now,
                cancellationToken);
        }

        await NotifySpecialistAndSupervisorOnSubmitAsync(task, cancellationToken);
        if (task.Kind == WorkflowTaskKind.FieldInspection)
        {
            await NotifySiblingSurveyInspectionSubmittedAsync(task, cancellationToken);
            await NotifySiblingAppraiserInspectionSubmittedAsync(task, cancellationToken);
        }

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        ReopenPartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
            return (null, Error("إعادة الفتح غير مدعومة لهذا النوع"));

        if (actor is not null && !PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error("ليس لديك صلاحية إعادة فتح إرسال الطرف"));

        var returnNote = request.ReturnNote?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(returnNote))
            return (null, new Dictionary<string, string> { ["returnNote"] = "ملاحظة الإرجاع مطلوبة" });

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null)
            return (null, Error("لا يوجد إرسال مُكتمل لإعادته"));

        var now = _time.UtcNow();
        // B2: Redo invalidates acceptance within the root — the service only coordinates the package and task.
        var returnError = entity.ReturnForCorrection(
            returnNote, now, actor?.UserId, actor?.DisplayName);
        if (returnError is not null)
            return (null, Error(returnError));

        entity.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadReopened(entity.PayloadJson, returnNote, now);

        if (task.Kind == WorkflowTaskKind.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        // Reopen the submission and reopen the workflow task in one transaction so a
        // mid-failure cannot leave a reopened submission still marked completed on the task.
        await _repo.ExecuteInTransactionAsync(
            async ct =>
            {
                await _repo.SaveChangesAsync(ct);
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

        await NotifyPartyReturnedForCorrectionAsync(task, returnNote, cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
            return (null, Error("قبول المخرجات غير متاح لهذا النوع من المهام"));

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error("ليس لديك صلاحية قبول مخرجات الطرف"));

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, Error("لا يوجد إرسال مكتمل لقبوله"));

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, Error("المهمة غير مكتملة بعد"));

        var actorUserId = PartyTaskSubmissionRules.AcceptActorUserId(actor);
        var alreadyAccepted = entity.AcceptedAtUtc is not null;

        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
        {
            // Fee accrual and acceptance timestamp must succeed or fail together.
            var feeError = await _repo.ExecuteInTransactionAsync(
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
                        await _repo.SaveChangesAsync(ct);
                    }

                    return (Commit: true, Result: (string?)null);
                },
                cancellationToken);

            if (feeError is not null)
                return (null, Error(feeError));
        }
        else if (!alreadyAccepted)
        {
            // Appraisal accept = specialist اعتماد of تقرير التقييم in دراسة الحالة.
            // Field inspection accept stamp is legacy/optional (no longer gates appraisal).
            _ = entity.Accept(_time.UtcNow(), actorUserId, actor.DisplayName);
            await _repo.SaveChangesAsync(cancellationToken);
        }

        if (task.PropertyId is Guid propertyId)
        {
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:accepted",
                PartyTaskSubmissionRules.AcceptedTimelineTitle(task.Kind),
                entity.AcceptedByName ?? task.AssigneeName,
                "done",
                _time.UtcNow(),
                cancellationToken);
        }

        if (!alreadyAccepted)
            await NotifyPartyAcceptedAsync(task, cancellationToken);

        if (!alreadyAccepted)
        {
            await _auditLog.AppendAsync(_audit.Create(
                actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId,
                action: "case-study.party-submission.accepted",
                entityType: "PartyTaskSubmission",
                entityId: taskId.ToString("D"),
                before: new { status = "Submitted" },
                after: new
                {
                    status = "Accepted",
                    kind = task.Kind.ToString(),
                    poNumber = task.PoNumber,
                    acceptedBy = entity.AcceptedByName,
                    acceptedAtUtc = entity.AcceptedAtUtc,
                }), cancellationToken);
        }

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    // B2: Acceptance stamp Go to root — PartyTaskSubmission.Accept.
}
