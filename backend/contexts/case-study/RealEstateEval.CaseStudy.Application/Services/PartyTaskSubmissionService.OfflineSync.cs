using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Offline field work (security_offline_spec §4.4, decisions log ق-10): the source-data
/// fingerprint the inspector's device echoes back, the specialist alert when it is stale,
/// and the audit entry that keeps on-site completion apart from the upload moment.
/// </summary>
public partial class PartyTaskSubmissionService
{
    /// <summary>The property row alone — source fields only, no navigations.</summary>
    private async Task<WorkOrderProperty?> LoadSourcePropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        (await _repo.ListPropertiesAsync([propertyId], cancellationToken))
            .GetValueOrDefault(propertyId);

    /// <summary>
    /// The field inspector's device prefetches the submission list; each package carries the
    /// source fingerprint it will send back with offline saves.
    /// </summary>
    private Task<IReadOnlyDictionary<Guid, WorkOrderProperty>> LoadInspectedPropertiesAsync(
        IReadOnlyList<PartyTaskSubmission> entities,
        CancellationToken cancellationToken) =>
        _repo.ListPropertiesAsync(
            entities
                .Where(e => e.Kind == WorkflowTaskKindValues.FieldInspection && e.PropertyId is not null)
                .Select(e => e.PropertyId!.Value)
                .Distinct()
                .ToList(),
            cancellationToken);

    private static void ApplySourceFingerprint(
        PartyTaskSubmissionDto dto,
        PartyTaskSubmission entity,
        IReadOnlyDictionary<Guid, WorkOrderProperty> properties)
    {
        if (entity.Kind == WorkflowTaskKindValues.FieldInspection
            && entity.PropertyId is Guid propertyId
            && properties.TryGetValue(propertyId, out var property))
        {
            dto.SourceFingerprint = InspectionSourceDataRules.Fingerprint(property);
        }
    }

    /// <summary>Client-only marker — compared after the save, never stored in the package.</summary>
    private static (string PayloadJson, string? Seen) TakeSourceFingerprintSeen(
        WorkflowTask task,
        string payloadJson) =>
        task.Kind == WorkflowTaskKind.FieldInspection
            ? PartyTaskSubmissionPayloadRules.TakeString(payloadJson, InspectionSourceDataRules.SeenPayloadKey)
            : (payloadJson, null);

    /// <summary>
    /// Spec §4.4 special case: the specialist's source data (deed, owner, court, request,
    /// commissioning) changed after the inspector downloaded the task. The server's values
    /// stand; the case specialist is told to review the inspector's answers. One unread
    /// alert per task — a later save refreshes it instead of stacking.
    /// </summary>
    private async Task AlertSourceChangedSinceDownloadAsync(
        WorkflowTask task,
        string? sourceFingerprintSeen,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sourceFingerprintSeen)) return;
        if (task.PropertyId is not Guid propertyId) return;
        if (task.ParentTaskId is not Guid parentTaskId) return;

        var property = await LoadSourcePropertyAsync(propertyId, cancellationToken);
        if (property is null
            || !InspectionSourceDataRules.ChangedSinceDownload(sourceFingerprintSeen, property))
            return;

        var parent = await _repo.GetTaskAsync(parentTaskId, cancellationToken);
        var specialistAssigneeId = parent?.AssigneeId?.Trim();
        if (parent is null || string.IsNullOrWhiteSpace(specialistAssigneeId)) return;

        var specialistUserId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            specialistAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(specialistUserId)) return;

        var refLabel = string.Join(
            " — ",
            new[] { task.PoNumber?.Trim(), property.DeedNumber?.Trim() }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
        await _notifications.CreateForUserAsync(
            specialistUserId,
            new CreateUserNotificationRequest
            {
                Title = "تغيّرت بيانات مصدرية بعد تنزيل المعاين",
                Body = string.IsNullOrEmpty(refLabel)
                    ? "تغيّرت بيانات مصدرية بعد تنزيل المعاين — راجع الإجابات."
                    : $"تغيّرت بيانات مصدرية بعد تنزيل المعاين — راجع الإجابات ({refLabel}).",
                Tone = "warn",
                Href = $"/case-study/{Uri.EscapeDataString(parent.Id.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = parent.Id.ToString(),
                SourceEvent = $"inspection-source-changed:{task.Id}",
            },
            cancellationToken);
    }

    /// <summary>
    /// ق-10: the approved inspection stamp is the on-site completion the device recorded
    /// (also in the payload's inspection date/time); the upload moment is this request —
    /// both go to the audit trail, kept apart.
    /// </summary>
    private Task AuditInspectionCompletionAsync(
        WorkflowTask task,
        PartyTaskSubmission entity,
        PartySubmissionActor? actor,
        DateTime uploadedAtUtc,
        CancellationToken cancellationToken) =>
        _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId,
            action: "case-study.party-submission.submitted",
            entityType: "PartyTaskSubmission",
            entityId: task.Id.ToString("D"),
            before: new { status = "Draft" },
            after: new
            {
                status = "Submitted",
                kind = task.Kind.ToString(),
                poNumber = task.PoNumber,
                completedOnSiteAtUtc = PartyTaskSubmissionPayloadRules.ReadString(
                    entity.PayloadJson, "completedOnSiteAtUtc"),
                uploadedAtUtc,
            }), cancellationToken);
}
