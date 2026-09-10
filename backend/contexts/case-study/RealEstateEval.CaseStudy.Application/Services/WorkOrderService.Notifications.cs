using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class WorkOrderService
{
    /// <summary>
    /// Tells everyone still holding open work on the PO that it was cancelled or stopped.
    /// Best-effort: the lifecycle change is already committed.
    /// </summary>
    private async Task NotifyPartiesLifecycleStoppedAsync(
        string poNumber,
        string lifecycleStatus,
        CancellationToken cancellationToken)
    {
        var recipients = await _recipients.ResolveAssigneeUserIdsForPoAsync(
            poNumber,
            [
                WorkflowTaskKind.CaseStudyProperty,
                WorkflowTaskKind.FieldInspection,
                WorkflowTaskKind.EngineeringSurvey,
                WorkflowTaskKind.PropertyAppraisal,
            ],
            cancellationToken);
        if (recipients.Count == 0) return;

        var cancelled = lifecycleStatus == WorkOrderLifecycleStatus.Cancelled;
        await _notifications.CreateForUsersAsync(
            recipients,
            new CreateUserNotificationRequest
            {
                Title = cancelled ? "أمر عمل ملغى" : "أمر عمل متوقف",
                Body = cancelled
                    ? $"أُلغي أمر العمل {poNumber} — أوقف العمل على مهامه."
                    : $"أُوقف أمر العمل {poNumber} — لا تتابع مهامه حتى إشعار آخر.",
                Tone = NotificationContract.Tones.Warn,
                Href = $"/po/{Uri.EscapeDataString(poNumber)}/property",
                Category = NotificationContract.Categories.Workflow,
                EntityType = NotificationContract.EntityTypes.WorkOrder,
                EntityId = poNumber,
                SourceEvent = $"work-order-{lifecycleStatus}:{poNumber}",
            },
            cancellationToken);
    }

    private async Task NotifySpecialistAssignedIfChangedAsync(
        string poNumber,
        string? previousEmail,
        string? newEmail,
        CancellationToken cancellationToken)
    {
        var next = newEmail?.Trim() ?? "";
        if (next.Length == 0) return;

        var previous = previousEmail?.Trim() ?? "";
        if (string.Equals(previous, next, StringComparison.OrdinalIgnoreCase))
            return;

        var userId = await _recipients.ResolveUserIdForEmailAsync(next, cancellationToken);
        if (userId is null) return;

        var po = poNumber.Trim();
        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = "معاملة جديدة بانتظارك",
                Body = $"أُسند إليك أمر العمل {po}.",
                Tone = "info",
                Href = $"/po/{Uri.EscapeDataString(po)}/property",
                Category = "workflow",
                EntityType = "work-order",
                EntityId = po,
                SourceEvent = $"work-order-assigned:{po}:{userId}",
            },
            cancellationToken);
    }

    /// <summary>
    /// Fan-out to case-study assignees on the PO (+ assignment specialist email when mapped).
    /// </summary>
    public async Task<(int NotifiedCount, string? Error)> NotifyIntakeFieldGapAsync(
        string poNumber,
        Guid propertyId,
        NotifyIntakeFieldGapRequest request,
        string? actorDisplayName,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        if (po.Length == 0) return (0, "رقم أمر العمل مطلوب.");

        var label = (request.FieldLabel ?? "").Trim();
        if (label.Length == 0) return (0, "اسم الحقل مطلوب.");

        var entity = await _loader.LoadAsync(po, cancellationToken, asNoTracking: true);
        if (entity is null) return (0, "أمر العمل غير موجود.");

        var property = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (property is null) return (0, "العقار غير موجود على أمر العمل.");

        var recipientIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in await _recipients.ResolveAssigneeUserIdsForPoAsync(
                     po,
                     [WorkflowTaskKind.CaseStudyProperty],
                     cancellationToken))
        {
            if (!string.IsNullOrWhiteSpace(id)) recipientIds.Add(id);
        }

        var specialistEmail = entity.AssignmentSpecialistEmail?.Trim() ?? "";
        if (specialistEmail.Length > 0)
        {
            var fromEmail = await _recipients.ResolveUserIdForEmailAsync(
                specialistEmail,
                cancellationToken);
            if (!string.IsNullOrWhiteSpace(fromEmail)) recipientIds.Add(fromEmail);
        }

        if (recipientIds.Count == 0)
            return (0, "لا يوجد أخصائي بيانات أولية مسند لإشعاره.");

        var deed = (property.DeedNumber ?? "").Trim();
        var fieldKey = string.IsNullOrWhiteSpace(request.FieldKey)
            ? label
            : request.FieldKey.Trim();
        var actor = string.IsNullOrWhiteSpace(actorDisplayName)
            ? "المقيّم"
            : actorDisplayName.Trim();
        var href =
            $"/po/{Uri.EscapeDataString(po)}/property/{propertyId:D}";

        await _notifications.CreateForUsersAsync(
            recipientIds,
            new CreateUserNotificationRequest
            {
                Title = "نقص في البيانات الأولية",
                Body =
                    $"{label} ناقص على الصك {(deed.Length > 0 ? deed : "—")} — أمر العمل {po}. طلب الاستكمال من {actor}.",
                Tone = NotificationContract.Tones.Warn,
                Href = href,
                Category = NotificationContract.Categories.Workflow,
                EntityType = NotificationContract.EntityTypes.Property,
                EntityId = propertyId.ToString("D"),
                Actor = actor,
                SourceEvent = $"intake-field-gap:{propertyId:N}:{fieldKey}",
            },
            cancellationToken);

        return (recipientIds.Count, null);
    }
}
