using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Grouped property (decision 2026-10-18): the second deed's inspection starts from the first
/// deed's — the site inputs (<see cref="PropertyGroupDataSyncRules.FillEmptyInspectorPayload"/>)
/// and the photos (files copied to the new task by the attachments service, then linked by
/// <see cref="InspectionSiblingPrefillRules.MergePhotos"/>). Everything stays editable by the
/// inspector, who sends the inspection in his own name. Boundaries never travel.
/// </summary>
public sealed class InspectionPrefillFromSiblingService : IInspectionPrefillFromSibling
{
    public const string TaskNotFoundAr = "المهمة غير موجودة";
    public const string NotAnInspectionAr = "هذه ليست مهمة معاينة ميدانية";
    public const string NotAllowedAr = "لا تملك صلاحية تعبئة هذه المعاينة";

    private readonly IPropertyGroupRepository _db;
    private readonly IInspectionPhotoCopier _copier;
    private readonly IAuditLogWriter _audit;
    private readonly IAuditLogAppend _auditLog;
    private readonly TimeProvider _time;

    public InspectionPrefillFromSiblingService(
        IPropertyGroupRepository db,
        IInspectionPhotoCopier copier,
        IAuditLogWriter audit,
        IAuditLogAppend auditLog,
        TimeProvider? time = null)
    {
        _db = db;
        _copier = copier;
        _audit = audit;
        _auditLog = auditLog;
        _time = time ?? TimeProvider.System;
    }

    public async Task<(InspectionPrefillResultDto? Result, string? Error)> PrefillAsync(
        Guid taskId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.GetTaskAsync(taskId, cancellationToken);
        if (task is null) return (null, TaskNotFoundAr);
        if (task.Kind != WorkflowTaskKind.FieldInspection) return (null, NotAnInspectionAr);
        if (actor is null
            || !PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole, task.AssigneeId, actor.UserId, actor.DistributionAssigneeId))
        {
            return (null, NotAllowedAr);
        }

        if (task.PropertyId is not Guid propertyId)
            return (Nothing("المهمة بلا عقار"), null);

        var membership = await _db.GetActiveMembershipAsync(propertyId, cancellationToken);
        if (membership is null)
            return (Nothing("العقار ليس في مجمّع"), null);

        var siblingIds = (await _db.ListActiveMembersAsync(membership.GroupId, cancellationToken))
            .Select(m => m.PropertyId)
            .Where(id => id != propertyId)
            .ToList();
        if (siblingIds.Count == 0)
            return (Nothing("لا صك شقيق في المجمّع"), null);

        var inspections = await _db.ListFieldInspectionsForUpdateAsync(
            siblingIds.Append(propertyId).ToList(),
            cancellationToken);
        var destination = inspections.FirstOrDefault(s => s.WorkflowTaskId == taskId);
        if (!InspectionSiblingPrefillRules.MayPrefill(destination))
            return (Nothing("معاينة هذا الصك بدأت فعلًا"), null);

        var source = InspectionSiblingPrefillRules.ChooseSource(
            inspections.Where(s => s.WorkflowTaskId != taskId && siblingIds.Contains(s.PropertyId ?? Guid.Empty)));
        if (source is null)
            return (Nothing("لا معاينة للصك الشقيق بعد"), null);

        var now = _time.UtcNow();
        var created = destination is null;
        destination ??= PartyTaskSubmission.CreateDraft(
            taskId, WorkflowTaskKindValues.FieldInspection, propertyId, task.PoNumber, now);

        var (json, slots) = PropertyGroupDataSyncRules.FillEmptyInspectorPayload(
            source.PayloadJson,
            destination.PayloadJson);
        destination.PayloadJson = json;
        var photos = await CopyPhotosIntoDraftAsync(source, destination, cancellationToken);
        if (slots == 0 && photos == 0)
            return (Nothing("لا شيء يُنقل من معاينة الصك الشقيق"), null);

        destination.UpdatedAtUtc = now;
        if (created) _db.AddSubmission(destination);
        await _db.SaveChangesAsync(cancellationToken);

        var actorId = string.IsNullOrWhiteSpace(actor.UserId) ? "unknown" : actor.UserId;
        await _auditLog.AppendAsync(_audit.Create(
            actorId,
            "PROPERTY_GROUP_INSPECTION_PREFILLED",
            "workflow_task",
            taskId.ToString("D"),
            null,
            new { fromTaskId = source.WorkflowTaskId, fromPropertyId = source.PropertyId, slots, photos, created }),
            cancellationToken);

        return (new InspectionPrefillResultDto
        {
            Prefilled = true,
            SlotsFilled = slots,
            PhotosLinked = photos,
            SourceTaskId = source.WorkflowTaskId.ToString("D"),
        }, null);
    }

    public async Task<int> CopyPhotosIntoDraftAsync(
        PartyTaskSubmission source,
        PartyTaskSubmission destination,
        CancellationToken cancellationToken = default)
    {
        if (source.WorkflowTaskId == destination.WorkflowTaskId) return 0;
        if (!InspectionSiblingPrefillRules.MayPrefill(destination)) return 0;
        if (InspectionSiblingPrefillRules.PhotoAttachmentIds(source.PayloadJson).Count == 0) return 0;

        var map = await _copier.CopyInspectionPhotosAsync(
            source.WorkflowTaskId,
            destination.WorkflowTaskId,
            cancellationToken);
        if (map.Count == 0) return 0;

        var (json, linked) = InspectionSiblingPrefillRules.MergePhotos(
            source.PayloadJson,
            destination.PayloadJson,
            map);
        if (linked > 0) destination.PayloadJson = json;
        return linked;
    }

    private static InspectionPrefillResultDto Nothing(string reason) =>
        new() { Prefilled = false, Reason = reason };
}
