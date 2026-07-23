using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public class PartyTaskSubmissionService : IPartyTaskSubmissionService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static readonly HashSet<string> AllowedKinds =
    [
        "engineering-survey",
        "property-appraisal",
        "government-review",
        "valuation-coordination",
        "field-inspection",
    ];

    private readonly ApplicationDbContext _db;
    private readonly IWorkflowTaskService _tasks;
    private readonly IFieldInspectionAttachmentVerifier _fieldInspectionAttachments;
    private readonly IPropertyTimelineService _timeline;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IPermissionService _permissions;
    private readonly IPropertyKeyGateResolver _keyGates;
    private readonly IKeyEnvelopesService _keyEnvelopes;
    private readonly IInspectorFeeService _inspectorFees;

    public PartyTaskSubmissionService(
        ApplicationDbContext db,
        IWorkflowTaskService tasks,
        IFieldInspectionAttachmentVerifier fieldInspectionAttachments,
        IPropertyTimelineService timeline,
        IHttpContextAccessor httpContextAccessor,
        IPermissionService permissions,
        IPropertyKeyGateResolver keyGates,
        IKeyEnvelopesService keyEnvelopes,
        IInspectorFeeService inspectorFees)
    {
        _db = db;
        _tasks = tasks;
        _fieldInspectionAttachments = fieldInspectionAttachments;
        _timeline = timeline;
        _httpContextAccessor = httpContextAccessor;
        _permissions = permissions;
        _keyGates = keyGates;
        _keyEnvelopes = keyEnvelopes;
        _inspectorFees = inspectorFees;
    }

    public async Task<PartyTaskSubmissionDto?> GetAsync(
        Guid taskId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.PartyTaskSubmissions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<IReadOnlyList<PartyTaskSubmissionDto>> ListForTasksAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default)
    {
        if (workflowTaskIds.Count == 0) return [];

        var ids = workflowTaskIds.Distinct().Take(500).ToList();
        var entities = await _db.PartyTaskSubmissions
            .AsNoTracking()
            .Where(s => ids.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        return entities.Select(ToDto).ToList();
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SaveDraftAsync(
        Guid taskId,
        SavePartyTaskSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (!AllowedKinds.Contains(task.Kind))
            return (null, new Dictionary<string, string> { ["_"] = "نوع المهمة غير مدعوم" });

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
                Kind = task.Kind,
                PropertyId = task.PropertyId,
                PoNumber = task.PoNumber,
                CreatedAtUtc = now,
            };
            _db.PartyTaskSubmissions.Add(entity);
        }

        var payloadJson = request.Payload.ValueKind == JsonValueKind.Undefined
            ? entity.PayloadJson
            : request.Payload.GetRawText();

        var status = ExtractStatus(payloadJson) ?? entity.Status;
        if (status is PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "استخدم نقطة الإرسال لتقديم العمل" });

        entity.PayloadJson = payloadJson;
        entity.Status = status is PartyTaskSubmissionStatus.Reopened
            ? PartyTaskSubmissionStatus.Reopened
            : PartyTaskSubmissionStatus.Draft;
        entity.PropertyId = task.PropertyId;
        entity.PoNumber = task.PoNumber;
        entity.UpdatedAtUtc = now;

        if (task.Kind == "field-inspection")
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        if (task.Kind == "government-review")
            await BridgeGovernmentReviewToEnvelopeAsync(task, payloadJson, cancellationToken);

        return (ToDto(entity), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> SubmitAsync(
        Guid taskId,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (!AllowedKinds.Contains(task.Kind))
            return (null, new Dictionary<string, string> { ["_"] = "نوع المهمة غير مدعوم" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد مسودة للإرسال" });

        if (entity.Status is PartyTaskSubmissionStatus.Submitted)
            return (ToDto(entity), null);

        var validationErrors = await ValidateForSubmitAsync(entity, cancellationToken);
        if (validationErrors.Count > 0)
            return (null, validationErrors);

        var now = DateTime.UtcNow;
        entity.Status = PartyTaskSubmissionStatus.Submitted;
        entity.SubmittedAtUtc = now;
        entity.UpdatedAtUtc = now;
        entity.PayloadJson = SetPayloadStatus(entity.PayloadJson, PartyTaskSubmissionStatus.Submitted, now);

        if (entity.Kind == "field-inspection")
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        if (entity.Kind == "government-review")
            await BridgeGovernmentReviewToEnvelopeAsync(task, entity.PayloadJson, cancellationToken);

        await _tasks.PatchAsync(
            taskId,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatus.Completed, Phase = "done" },
            cancellationToken);

        if (task.PropertyId is Guid propertyId)
        {
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:submitted",
                PartySubmittedTitle(entity.Kind),
                task.AssigneeName,
                "done",
                now,
                cancellationToken);
        }

        return (ToDto(entity), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        ReopenPartyTaskSubmissionRequest request,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (task.Kind is not ("engineering-survey" or "property-appraisal" or "field-inspection" or "government-review"))
            return (null, new Dictionary<string, string> { ["_"] = "إعادة الفتح غير مدعومة لهذا النوع" });

        var returnNote = request.ReturnNote?.Trim() ?? "";
        if (task.Kind is "engineering-survey" or "field-inspection" or "government-review" && string.IsNullOrWhiteSpace(returnNote))
            return (null, new Dictionary<string, string> { ["returnNote"] = "ملاحظة الإرجاع مطلوبة" });

        var entity = await _db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مُكتمل لإعادته" });

        var now = DateTime.UtcNow;
        entity.Status = PartyTaskSubmissionStatus.Reopened;
        entity.ReturnNote = returnNote;
        entity.SubmittedAtUtc = null;
        entity.UpdatedAtUtc = now;
        entity.PayloadJson = SetPayloadReopened(entity.PayloadJson, returnNote, now);

        if (task.Kind == "field-inspection")
            await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        await _tasks.PatchAsync(
            taskId,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatus.Open, Phase = "done" },
            cancellationToken);

        return (ToDto(entity), null);
    }

    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null)
            return (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" });

        if (task.Kind != "engineering-survey")
            return (null, new Dictionary<string, string> { ["_"] = "قبول المخرجات متاح لمهام الرفع المساحي فقط" });

        var entity = await _db.PartyTaskSubmissions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, new Dictionary<string, string> { ["_"] = "لا يوجد إرسال مكتمل لقبوله" });

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, new Dictionary<string, string> { ["_"] = "مهمة الرفع المساحي غير مكتملة" });

        var (_, feeError) = await _inspectorFees.AccrueEngineeringSurveyFeeAsync(
            taskId,
            string.IsNullOrWhiteSpace(actorUserId) ? "system" : actorUserId,
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
                task.AssigneeName,
                "done",
                DateTime.UtcNow,
                cancellationToken);
        }

        return (ToDto(entity), null);
    }

    private async Task<Dictionary<string, string>> ValidateForSubmitAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var errors = ValidateForSubmit(entity);
        var documentary = await ValidateDocumentaryGatesAsync(entity, cancellationToken);
        foreach (var (key, message) in documentary)
            errors[key] = message;

        if (errors.Count > 0 || entity.Kind != "field-inspection")
            return errors;

        try
        {
            using var doc = JsonDocument.Parse(entity.PayloadJson);
            var attachmentErrors = await _fieldInspectionAttachments.VerifyAsync(
                entity.WorkflowTaskId,
                doc.RootElement,
                cancellationToken);
            foreach (var (key, message) in attachmentErrors)
                errors[key] = message;
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
                var inspectionCompleted = false;
                if (entity.PropertyId is Guid pid)
                {
                    var surveyTask = await _db.WorkflowTasks.AsNoTracking()
                        .FirstOrDefaultAsync(t => t.Id == entity.WorkflowTaskId, cancellationToken);
                    if (surveyTask?.ParentTaskId is Guid parentId)
                    {
                        inspectionCompleted = await _db.WorkflowTasks.AsNoTracking().AnyAsync(
                            t => t.ParentTaskId == parentId
                                && t.PropertyId == pid
                                && t.Kind == "field-inspection"
                                && t.Status == WorkflowTaskStatus.Completed,
                            cancellationToken);
                    }
                }

                var informalOk = property is null
                    || DocumentaryWorkflowRules.InformalAccessUnlocked(
                        property.PlanNumber,
                        property.PlotNumber,
                        property.LocationMapUrl);

                var surveyBlock = DocumentaryWorkflowRules.SurveyWorkBlockReason(
                    bypass,
                    inspectionCompleted,
                    hasActiveFailure,
                    informalOk);
                if (surveyBlock is not null)
                    errors["_documentary"] = surveyBlock;

                var hasPhone = property is not null
                    && DocumentaryWorkflowRules.HasAnyPartyPhone(property.Contacts);
                var phoneWasPresent = GetBool(root, "declarationPhoneSatisfied");
                var phoneBlock = DocumentaryWorkflowRules.DeclarationPhoneBlockReason(
                    bypass,
                    hasPhone,
                    phoneWasPresent);
                if (phoneBlock is not null
                    && (HasNonEmpty(root, "siteLetterFileName") || GetBool(root, "siteConfirmed")))
                {
                    errors["siteLetterFileName"] = phoneBlock;
                }
                break;
            }

            case "field-inspection":
            {
                if (property is not null)
                {
                    var informalBlock = DocumentaryWorkflowRules.InformalAccessBlockReason(
                        bypass,
                        property.PlanNumber,
                        property.PlotNumber,
                        property.LocationMapUrl);
                    if (informalBlock is not null)
                        errors["_documentary"] = informalBlock;
                }

                var vacantLand = GetBool(root, "vacantLand")
                    || string.Equals(GetString(root, "vacantLand"), "yes", StringComparison.OrdinalIgnoreCase);
                var gate = await _keyGates.ResolveAsync(
                    entity.PropertyId,
                    entity.PoNumber,
                    property?.DeedNumber,
                    property?.RequestNumber,
                    cancellationToken);
                var keyAvailable = gate.KeyAvailable
                    || GetBool(root, "keyAvailable")
                    || string.Equals(GetString(root, "keyHandedToInspector"), "yes", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(GetString(root, "keysStatus"), "received", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(GetString(root, "keysStatus"), "not_required", StringComparison.OrdinalIgnoreCase);

                var keyBlock = DocumentaryWorkflowRules.InspectorSubmitKeyBlockReason(
                    bypass,
                    vacantLand,
                    keyAvailable);
                if (keyBlock is not null)
                    errors["keyAvailable"] = keyBlock;

                var hasPhone = property is not null
                    && DocumentaryWorkflowRules.HasAnyPartyPhone(property.Contacts);
                var phoneWasPresent = GetBool(root, "declarationPhoneSatisfied");
                var phoneBlock = DocumentaryWorkflowRules.DeclarationPhoneBlockReason(
                    bypass,
                    hasPhone,
                    phoneWasPresent);
                if (phoneBlock is not null && GetBool(root, "clientDeclarationSigned"))
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

    private static string? GetString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return null;
        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : prop.ToString();
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
            keysStatus = GetString(doc.RootElement, "keysStatus")?.Trim() ?? "";
            handed = GetString(doc.RootElement, "keyHandedToInspector")?.Trim() ?? "";
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

    private static Dictionary<string, string> ValidateForSubmit(PartyTaskSubmission entity)
    {
        var errors = new Dictionary<string, string>();
        try
        {
            using var doc = JsonDocument.Parse(entity.PayloadJson);
            var root = doc.RootElement;

            switch (entity.Kind)
            {
                case "engineering-survey":
                    if (!HasNonEmpty(root, "latitude") || !HasNonEmpty(root, "longitude"))
                        errors["coordinates"] = "الإحداثيات مطلوبة";
                    if (!HasNonEmpty(root, "surveyReportFileName"))
                        errors["surveyReportFileName"] = "تقرير الرفع المساحي مطلوب";
                    if (!HasNonEmpty(root, "siteLetterFileName"))
                        errors["siteLetterFileName"] = "خطاب الموقع مطلوب";
                    if (!GetBool(root, "siteConfirmed"))
                        errors["siteConfirmed"] = "يجب تأكيد الموقع";
                    break;

                case "property-appraisal":
                    if (!HasNonEmpty(root, "evaluatorPrice"))
                        errors["evaluatorPrice"] = "سعر التقييم مطلوب";
                    if (!HasNonEmpty(root, "reportFileName"))
                        errors["reportFileName"] = "تقرير PDF مطلوب";
                    break;

                case "government-review":
                    if (!HasNonEmpty(root, "visitStatus"))
                        errors["visitStatus"] = "حالة الزيارة مطلوبة";
                    if (!GetBool(root, "confirmed"))
                        errors["confirmed"] = "يجب تأكيد صحة البيانات";
                    break;

                case "valuation-coordination":
                    if (!GetBool(root, "receiptConfirmed"))
                        errors["receiptConfirmed"] = "يجب تأكيد الاستلام";
                    break;

                case "field-inspection":
                    foreach (var (key, message) in FieldInspectionSubmissionValidator.Validate(root))
                        errors[key] = message;
                    break;
            }
        }
        catch
        {
            errors["_"] = "بيانات الإرسال غير صالحة";
        }

        return errors;
    }

    private static bool HasNonEmpty(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return false;
        return prop.ValueKind switch
        {
            JsonValueKind.String => !string.IsNullOrWhiteSpace(prop.GetString()),
            JsonValueKind.Number => true,
            JsonValueKind.True => true,
            _ => false,
        };
    }

    private static bool GetBool(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return false;
        return prop.ValueKind == JsonValueKind.True;
    }

    private static string? ExtractStatus(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("status", out var status))
                return status.GetString();
        }
        catch
        {
            // ignore
        }

        return null;
    }

    private static string SetPayloadStatus(string payloadJson, string status, DateTime submittedAt)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)DeserializeElement(kv.Value));
            mutable["status"] = status;
            mutable["submittedAtUtc"] = submittedAt.ToString("O");
            mutable["updatedAtUtc"] = submittedAt.ToString("O");
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
    }

    private static string SetPayloadReopened(string payloadJson, string returnNote, DateTime now)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)DeserializeElement(kv.Value));
            mutable["status"] = PartyTaskSubmissionStatus.Reopened;
            mutable["returnNote"] = returnNote;
            mutable["submittedAtUtc"] = null;
            mutable["updatedAtUtc"] = now.ToString("O");
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
    }

    private static object? DeserializeElement(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => JsonSerializer.Deserialize<object>(element.GetRawText(), JsonOpts),
        };

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
            TaskId = entity.WorkflowTaskId.ToString(),
            Kind = entity.Kind,
            Status = entity.Status,
            PropertyId = entity.PropertyId?.ToString(),
            PoNumber = entity.PoNumber,
            Payload = payload,
            ReturnNote = entity.ReturnNote,
            SubmittedAtUtc = entity.SubmittedAtUtc?.ToString("O"),
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
