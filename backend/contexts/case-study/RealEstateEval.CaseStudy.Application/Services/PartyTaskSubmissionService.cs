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

    private readonly IPartyTaskSubmissionRepository _repo;
    private readonly IPartyTaskFailureGate _failures;
    private readonly IWorkflowTaskService _tasks;
    private readonly IFieldInspectionAttachmentVerifier _fieldInspectionAttachments;
    private readonly IPropertyTimelineService _timeline;
    private readonly ICurrentPrototypeRoleResolver _currentRole;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
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
    }

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

        var entities = await _repo.ListSubmissionsAsync(ids, cancellationToken);

        // Batch sibling preview flags — a bounded number of queries per list, not per row.
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

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        PartySubmissionActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!AllowedKinds.Contains(task.Kind))
            return (null, Error("نوع المهمة غير مدعوم"));

        var canAssigneeWrite = actor is null
            || PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId);
        var canStaffCorrectFieldInspection = actor is not null
            && task.Kind == WorkflowTaskKind.FieldInspection
            && PoRoleMatrixRules.CanCorrectFieldInspectionSubmission(actor.PrototypeRole);

        if (actor is not null && !canAssigneeWrite && !canStaffCorrectFieldInspection)
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

        if (!AllowedKinds.Contains(task.Kind))
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
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!AllowedKinds.Contains(task.Kind))
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

        if (!AllowedKinds.Contains(task.Kind))
            return (null, Error("قبول المخرجات غير متاح لهذا النوع من المهام"));

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error("ليس لديك صلاحية قبول مخرجات الطرف"));

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, Error("لا يوجد إرسال مكتمل لقبوله"));

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, Error("المهمة غير مكتملة بعد"));

        var actorUserId = string.IsNullOrWhiteSpace(actor.UserId) ? "system" : actor.UserId;
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
            // Field inspection: Enfaz package gate. Appraisal stamp is receive/acknowledge only.
            _ = entity.Accept(_time.UtcNow(), actorUserId, actor.DisplayName);
            await _repo.SaveChangesAsync(cancellationToken);
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
            await NotifyPartyAcceptedAsync(task, cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    // B2: Acceptance stamp Go to root — PartyTaskSubmission.Accept.

    private static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

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
        var bypass = DocumentaryWorkflowRules.RoleBypassesDocumentaryGates(
            await _currentRole.ResolveAsync(cancellationToken));

        WorkOrderProperty? property = null;
        if (entity.PropertyId is Guid propertyId)
            property = await _repo.GetPropertyWithContactsAsync(propertyId, cancellationToken);

        var propertyIdStr = entity.PropertyId?.ToString() ?? "";
        var hasActiveFailure = await _failures.HasActiveFailureAsync(
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
                    && (await SiblingInspectionFlagsAsync(
                        entity.WorkflowTaskId, pid, includeAccepted: false, cancellationToken)).Completed;

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
                    && (PartyTaskSubmissionPayloadRules.HasNonEmpty(root, "siteLetterFileName")
                        || PartyTaskSubmissionPayloadRules.GetBool(root, "siteConfirmed")))
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

    private async Task SyncFieldInspectionWorkspaceAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        using var doc = JsonDocument.Parse(entity.PayloadJson);
        var projected = FieldInspectionWorkspaceProjector.Project(
            entity, doc.RootElement, _time.UtcNow());
        await _repo.UpsertFieldInspectionWorkspaceAsync(projected, cancellationToken);
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
        if (!NeedsInspectionFlag(entity.Kind))
            return dto;

        var flags = entity.PropertyId is Guid propertyId
            ? await SiblingInspectionFlagsAsync(
                entity.WorkflowTaskId,
                propertyId,
                includeAccepted: entity.Kind == WorkflowTaskKindValues.PropertyAppraisal,
                cancellationToken)
            : (Completed: false, Accepted: false);

        dto.FieldInspectionCompleted = flags.Completed;
        if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
            dto.FieldInspectionAccepted = flags.Accepted;

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
