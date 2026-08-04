using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

public class PartyTaskSubmissionService : IPartyTaskSubmissionService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Party kinds that submit work through this service — everything but the parent.</summary>
    private static readonly HashSet<WorkflowTaskKind> AllowedKinds =
    [
        WorkflowTaskKind.EngineeringSurvey,
        WorkflowTaskKind.PropertyAppraisal,
        WorkflowTaskKind.GovernmentReview,
        WorkflowTaskKind.ValuationCoordination,
        WorkflowTaskKind.FieldInspection,
    ];

    private readonly ApplicationDbContext _db;
    private readonly IWorkflowTaskService _tasks;
    private readonly IFieldInspectionAttachmentVerifier _fieldInspectionAttachments;
    private readonly IPropertyTimelineService _timeline;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IPermissionService _permissions;
    private readonly IKeyEnvelopesService _keyEnvelopes;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;

    public PartyTaskSubmissionService(
        ApplicationDbContext db,
        IWorkflowTaskService tasks,
        IFieldInspectionAttachmentVerifier fieldInspectionAttachments,
        IPropertyTimelineService timeline,
        IHttpContextAccessor httpContextAccessor,
        IPermissionService permissions,
        IKeyEnvelopesService keyEnvelopes,
        IInspectorFeeService inspectorFees,
        INotificationService notifications,
        NotificationRecipientResolver recipients)
    {
        _db = db;
        _tasks = tasks;
        _fieldInspectionAttachments = fieldInspectionAttachments;
        _timeline = timeline;
        _httpContextAccessor = httpContextAccessor;
        _permissions = permissions;
        _keyEnvelopes = keyEnvelopes;
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
        return entity is null ? null : await ToDtoAsync(entity, cancellationToken);
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

        var result = new List<PartyTaskSubmissionDto>(entities.Count);
        foreach (var entity in entities)
            result.Add(await ToDtoAsync(entity, cancellationToken));
        return result;
    }

    private async Task<bool> CanReadTaskAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)) return true;

        var assigneeId = await _db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => t.AssigneeId)
            .FirstOrDefaultAsync(cancellationToken);

        return PoRoleMatrixRules.CanReadPartyTask(
            actor.PrototypeRole,
            assigneeId,
            actor.UserId,
            actor.DistributionAssigneeId);
    }

    private async Task<List<Guid>> ReadableTaskIdsAsync(
        IReadOnlyList<Guid> taskIds,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        var tasks = await _db.WorkflowTasks
            .AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .Select(t => new { t.Id, t.AssigneeId })
            .ToListAsync(cancellationToken);

        return tasks
            .Where(t => PoRoleMatrixRules.CanReadPartyTask(
                actor.PrototypeRole,
                t.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId))
            .Select(t => t.Id)
            .ToList();
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

        var now = DateTime.UtcNow;
        if (entity is null)
        {
            entity = new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = taskId,
                Kind = task.Kind.ToDbValue(),
                PropertyId = task.PropertyId,
                PoNumber = task.PoNumber,
                CreatedAtUtc = now,
            };
            _db.PartyTaskSubmissions.Add(entity);
        }

        var payloadJson = request.Payload.ValueKind == JsonValueKind.Undefined
            ? entity.PayloadJson
            : request.Payload.GetRawText();

        if (task.Kind == WorkflowTaskKind.GovernmentReview)
            payloadJson = StripLegacyKeysProofDataUrls(payloadJson);

        var status = PartyTaskSubmissionPayloadRules.ExtractStatus(payloadJson) ?? entity.Status;
        if (status is PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "استخدم نقطة الإرسال لتقديم العمل" });

        entity.PayloadJson = payloadJson;
        entity.Status = status is PartyTaskSubmissionStatus.Reopened
            ? PartyTaskSubmissionStatus.Reopened
            : PartyTaskSubmissionStatus.Draft;
        entity.PropertyId = task.PropertyId;
        entity.PoNumber = task.PoNumber;
        entity.UpdatedAtUtc = now;

        if (task.Kind == WorkflowTaskKind.FieldInspection)
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        if (task.Kind == WorkflowTaskKind.GovernmentReview)
            await BridgeGovernmentReviewToEnvelopeAsync(task, payloadJson, cancellationToken);

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

        var now = DateTime.UtcNow;
        entity.Status = PartyTaskSubmissionStatus.Submitted;
        entity.SubmittedAtUtc = now;
        entity.UpdatedAtUtc = now;
        if (actor is not null)
        {
            entity.SubmittedByUserId = actor.UserId;
            entity.SubmittedByName = string.IsNullOrWhiteSpace(actor.DisplayName)
                ? task.AssigneeName
                : actor.DisplayName.Trim();
        }
        entity.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadStatus(entity.PayloadJson, PartyTaskSubmissionStatus.Submitted, now);

        if (entity.Kind == "field-inspection")
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

        // Side effects after the durable state is committed. Key-envelope bridging clears
        // the change tracker, so it must not run inside the transaction above.
        if (entity.Kind == "government-review")
            await BridgeGovernmentReviewToEnvelopeAsync(task, entity.PayloadJson, cancellationToken);

        if (task.PropertyId is Guid propertyId)
        {
            var actorLabel = entity.SubmittedByName
                ?? (string.IsNullOrWhiteSpace(task.AssigneeName) ? null : task.AssigneeName);
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:submitted",
                PartySubmittedTitle(entity.Kind),
                actorLabel,
                "done",
                now,
                cancellationToken);
        }

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
            or WorkflowTaskKind.FieldInspection
            or WorkflowTaskKind.GovernmentReview))
        {
            return (null, new Dictionary<string, string> { ["_"] = "إعادة الفتح غير مدعومة لهذا النوع" });
        }

        if (actor is not null && !PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية إعادة فتح إرسال الطرف" });

        var returnNote = request.ReturnNote?.Trim() ?? "";
        if (task.Kind is WorkflowTaskKind.EngineeringSurvey
                or WorkflowTaskKind.FieldInspection
                or WorkflowTaskKind.GovernmentReview
            && string.IsNullOrWhiteSpace(returnNote))
        {
            return (null, new Dictionary<string, string> { ["returnNote"] = "ملاحظة الإرجاع مطلوبة" });
        }

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مُكتمل لإعادته" });

        var now = DateTime.UtcNow;
        entity.Status = PartyTaskSubmissionStatus.Reopened;
        entity.ReturnNote = returnNote;
        entity.SubmittedAtUtc = null;
        // Returning for correction voids the acceptance so the specialist can
        // accept the corrected outputs again.
        entity.AcceptedAtUtc = null;
        entity.AcceptedByUserId = null;
        entity.AcceptedByName = null;
        if (actor is not null)
        {
            entity.ReopenedByUserId = actor.UserId;
            entity.ReopenedByName = string.IsNullOrWhiteSpace(actor.DisplayName)
                ? null
                : actor.DisplayName.Trim();
        }
        entity.UpdatedAtUtc = now;
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
            await NotifyEngineeringSurveyAssigneeAsync(
                task,
                title: "إعادة الرفع المساحي للتصحيح",
                body: string.IsNullOrWhiteSpace(returnNote)
                    ? "أُعيدت مخرجات الرفع المساحي للتصحيح."
                    : $"أُعيدت مخرجات الرفع المساحي للتصحيح: {returnNote.Trim()}",
                tone: "warn",
                sourceEvent: $"engineering-survey-returned:{taskId}",
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

        if (task.Kind != WorkflowTaskKind.EngineeringSurvey)
            return (null, new Dictionary<string, string> { ["_"] = "قبول المخرجات متاح لمهام الرفع المساحي فقط" });

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, new Dictionary<string, string> { ["_"] = "ليس لديك صلاحية قبول مخرجات الطرف" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مكتمل لقبوله" });

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, new Dictionary<string, string> { ["_"] = "مهمة الرفع المساحي غير مكتملة" });

        var actorUserId = string.IsNullOrWhiteSpace(actor.UserId) ? "system" : actor.UserId;

        // Fee accrual and acceptance timestamp must succeed or fail together.
        var alreadyAccepted = entity.AcceptedAtUtc is not null;
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
                    entity.AcceptedAtUtc = DateTime.UtcNow;
                    entity.AcceptedByUserId = actorUserId;
                    entity.AcceptedByName = string.IsNullOrWhiteSpace(actor.DisplayName)
                        ? null
                        : actor.DisplayName.Trim();
                    await _db.SaveChangesAsync(ct);
                }

                return (Commit: true, Result: (string?)null);
            },
            cancellationToken);

        if (feeError is not null)
            return (null, new Dictionary<string, string> { ["_"] = feeError });

        if (task.PropertyId is Guid propertyId)
        {
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:accepted",
                "قبول مخرجات الرفع المساحي",
                entity.AcceptedByName ?? task.AssigneeName,
                "done",
                DateTime.UtcNow,
                cancellationToken);
        }

        if (!alreadyAccepted)
            await NotifyEngineeringSurveyAssigneeAsync(
                task,
                title: "قبول مخرجات الرفع المساحي",
                body: "تم قبول مخرجات الرفع المساحي واستحقاق الأتعاب.",
                tone: "success",
                sourceEvent: $"engineering-survey-accepted:{taskId}",
                cancellationToken);

        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    private async Task NotifyEngineeringSurveyAssigneeAsync(
        WorkflowTask task,
        string title,
        string body,
        string tone,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var assigneeId = task.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(assigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            assigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        var href = $"/active-survey/{Uri.EscapeDataString(task.Id.ToString())}";
        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = href,
                Category = "workflow",
                EntityType = "task",
                EntityId = task.Id.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

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
            if (entity.Kind == "field-inspection")
            {
                var attachmentErrors = await _fieldInspectionAttachments.VerifyAsync(
                    entity.WorkflowTaskId,
                    doc.RootElement,
                    cancellationToken);
                foreach (var (key, message) in attachmentErrors)
                    errors[key] = message;
            }
            else if (entity.Kind == "government-review")
            {
                foreach (var (key, message) in await VerifyGovernmentReviewAttachmentsAsync(
                             entity.WorkflowTaskId,
                             doc.RootElement,
                             cancellationToken))
                {
                    errors[key] = message;
                }
            }
        }
        catch
        {
            errors["_"] = "بيانات الإرسال غير صالحة";
        }

        return errors;
    }

    private async Task<Dictionary<string, string>> VerifyGovernmentReviewAttachmentsAsync(
        Guid workflowTaskId,
        JsonElement root,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string>();
        var refs = GovernmentReviewPayloadAttachments.Collect(root);
        if (refs.Count == 0)
        {
            // Legacy dataUrl-only proofs remain acceptable until fully migrated,
            // but prefer rejecting empty attachment ids when keysProofFiles exist
            // without any durable reference and without legacy dataUrl.
            if (root.TryGetProperty("keysProofFiles", out var files)
                && files.ValueKind == JsonValueKind.Array
                && files.GetArrayLength() > 0
                && !GovernmentReviewPayloadAttachments.HasLegacyDataUrlWithoutAttachment(root))
            {
                errors["keysProofFiles"] = "مرفقات إثبات المفتاح غير مرتبطة بالخادم";
            }
            return errors;
        }

        var ids = refs.Select(r => r.AttachmentId).Distinct().ToArray();
        var rows = await _db.FileAttachments.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var reference in refs)
        {
            if (!rows.TryGetValue(reference.AttachmentId, out var row))
            {
                errors["keysProofFiles"] = "مرفق إثبات المفتاح غير موجود في قاعدة البيانات";
                return errors;
            }

            if (!string.Equals(row.Scope, GovernmentReviewPayloadAttachments.Scope, StringComparison.Ordinal))
            {
                errors["keysProofFiles"] = "مرفق إثبات المفتاح لا يخص المراجعة الحكومية";
                return errors;
            }

            var expected = GovernmentReviewPayloadAttachments.ScopeKey(workflowTaskId, reference.ProofId);
            if (!string.Equals(row.ScopeKey, expected, StringComparison.Ordinal))
            {
                errors["keysProofFiles"] = "مرفق إثبات المفتاح مرتبط بمهمة أخرى";
                return errors;
            }
        }

        return errors;
    }

    /// <summary>
    /// Persist metadata + attachmentId only — drop embedded dataUrl bytes when a server id exists.
    /// Legacy entries without attachmentId keep dataUrl for backward compatibility.
    /// </summary>
    private static string StripLegacyKeysProofDataUrls(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("keysProofFiles", out var files)
                || files.ValueKind != JsonValueKind.Array)
            {
                return payloadJson;
            }

            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)PartyTaskSubmissionPayloadRules.DeserializeElement(kv.Value));

            var cleaned = new List<Dictionary<string, object?>>();
            foreach (var file in files.EnumerateArray())
            {
                if (file.ValueKind != JsonValueKind.Object) continue;
                var entry = new Dictionary<string, object?>();
                foreach (var prop in file.EnumerateObject())
                {
                    if (prop.NameEquals("dataUrl")
                        && file.TryGetProperty("attachmentId", out var aid)
                        && aid.ValueKind == JsonValueKind.String
                        && Guid.TryParse(aid.GetString(), out var gid)
                        && gid != Guid.Empty)
                    {
                        continue;
                    }
                    entry[prop.Name] = PartyTaskSubmissionPayloadRules.DeserializeElement(prop.Value);
                }
                cleaned.Add(entry);
            }

            mutable["keysProofFiles"] = cleaned;
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
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
        var hasActiveFailure = await _db.PropertyFailures.AsNoTracking().AnyAsync(
            f => f.PoNumber == entity.PoNumber
                && f.PropertyId == propertyIdStr
                && PropertyFailureStatus.Active.Contains(f.Status),
            cancellationToken);

        using var doc = JsonDocument.Parse(entity.PayloadJson);
        var root = doc.RootElement;

        switch (entity.Kind)
        {
            case "engineering-survey":
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

            case "field-inspection":
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

            case "government-review":
            {
                if (property is null) break;
                foreach (var (key, message) in DocumentaryWorkflowRules.GovernmentReviewSubmitFieldErrors(
                             bypass,
                             property.DeedNumber,
                             property.RequestNumber,
                             property.City,
                             property.District,
                             property.Circuit,
                             property.WorkOrder?.PoNumber ?? entity.PoNumber,
                             property.AssignmentMandateNumber,
                             property.AssignmentMandateDate))
                {
                    errors[key] = message;
                }
                break;
            }
        }

        return errors;
    }

    private async Task<bool> CurrentUserBypassesAsync(CancellationToken cancellationToken)
    {
        var userId = _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return false;
        var perms = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        return DocumentaryWorkflowRules.RoleBypassesDocumentaryGates(perms?.PrototypeRole);
    }

    /// <summary>
    /// Light write bridge: when gov-review marks keys received/handed, sync envelope assignment/handoff.
    /// Missing envelope is a UI warning only — never blocks finalize.
    /// </summary>
    private async Task BridgeGovernmentReviewToEnvelopeAsync(
        WorkflowTask task,
        string payloadJson,
        CancellationToken cancellationToken)
    {
        if (task.PropertyId is not Guid propertyId) return;

        string keysStatus;
        string handed;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            keysStatus = PartyTaskSubmissionPayloadRules.GetString(doc.RootElement, "keysStatus")?.Trim() ?? "";
            handed = PartyTaskSubmissionPayloadRules.GetString(doc.RootElement, "keyHandedToInspector")?.Trim() ?? "";
        }
        catch
        {
            return;
        }

        if (!string.Equals(keysStatus, "received", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(handed, "yes", StringComparison.OrdinalIgnoreCase))
            return;

        var property = await _db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId && !p.IsRemoved, cancellationToken);
        if (property is null) return;

        var requestNumber = property.RequestNumber?.Trim() ?? "";
        if (requestNumber.Length == 0) return;

        var envelope = await _db.KeyEnvelopes.AsNoTracking()
            .Include(e => e.Assignments)
            .Include(e => e.Handoffs)
            .Where(e => e.RequestNumber == requestNumber)
            .OrderByDescending(e => e.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (envelope is null) return;

        var actorId = _httpContextAccessor.HttpContext?.User
            ?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "system";
        var actorName = task.AssigneeName?.Trim();
        if (string.IsNullOrWhiteSpace(actorName))
            actorName = _httpContextAccessor.HttpContext?.User?.FindFirstValue("name") ?? "مراجع حكومي";

        if (string.Equals(keysStatus, "received", StringComparison.OrdinalIgnoreCase))
        {
            var deed = property.DeedNumber?.Trim() ?? "";
            var hasAssignment = envelope.Assignments.Any(a =>
                string.Equals(a.DeedNumber, deed, StringComparison.OrdinalIgnoreCase)
                || a.PropertyId == propertyId);
            if (!hasAssignment && deed.Length > 0)
            {
                await _keyEnvelopes.AddAssignmentAsync(
                    envelope.Id,
                    new AddKeyEnvelopeAssignmentRequest
                    {
                        DeedNumber = deed,
                        PropertyId = propertyId,
                        Notes = "مزامنة من المراجعة الحكومية",
                    },
                    actorId,
                    actorName,
                    cancellationToken);
            }
        }

        if (string.Equals(handed, "yes", StringComparison.OrdinalIgnoreCase)
            && envelope.Status == KeyEnvelopeStatuses.Reviewer)
        {
            var hasPendingOrConfirmed = envelope.Handoffs.Any(h =>
                h.Kind == KeyHandoffKinds.Internal
                && h.Status is KeyHandoffStatuses.PendingConfirm
                    or KeyHandoffStatuses.Confirmed
                    or KeyHandoffStatuses.Completed);
            if (!hasPendingOrConfirmed)
            {
                await _keyEnvelopes.CreateHandoffAsync(
                    envelope.Id,
                    new CreateKeyEnvelopeHandoffRequest
                    {
                        Kind = KeyHandoffKinds.Internal,
                        FromParty = "مراجع حكومي",
                        ToParty = "معاين ميداني",
                        Notes = "مزامنة من المراجعة الحكومية (تسليم للمعاين)",
                    },
                    actorId,
                    actorName,
                    cancellationToken);
            }
        }
    }

    private async Task SyncFieldInspectionWorkspaceAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        using var doc = JsonDocument.Parse(entity.PayloadJson);
        var projected = FieldInspectionWorkspaceProjector.Project(entity, doc.RootElement);
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
        Guid surveyTaskId,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var parentId = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Id == surveyTaskId)
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

    private async Task<PartyTaskSubmissionDto> ToDtoAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var dto = ToDto(entity);
        var needsInspectionFlag =
            entity.Kind is "engineering-survey" or "property-appraisal";
        if (needsInspectionFlag && entity.PropertyId is Guid propertyId)
        {
            dto.FieldInspectionCompleted = await IsSiblingFieldInspectionCompletedAsync(
                entity.WorkflowTaskId,
                propertyId,
                cancellationToken);
        }
        else if (needsInspectionFlag)
        {
            dto.FieldInspectionCompleted = false;
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

    private static string PartySubmittedTitle(string kind) => kind switch
    {
        "field-inspection" => "إتمام المعاينة الميدانية",
        "engineering-survey" => "إتمام الرفع المساحي",
        "property-appraisal" => "إتمام التقييم العقاري",
        "government-review" => "إتمام المراجعة الحكومية",
        "valuation-coordination" => "إتمام تنسيق التقييم",
        _ => "إتمام عمل الطرف",
    };
}
