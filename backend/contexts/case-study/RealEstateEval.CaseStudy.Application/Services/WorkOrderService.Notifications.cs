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

    /// <summary>CDO / super-admin oversight feed — one broadcast per new PO, not per property.</summary>
    private async Task NotifyCdoWorkOrderCreatedAsync(
        string poNumber,
        int propertyCount,
        CancellationToken cancellationToken)
    {
        var cdoUserIds = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "cdo",
            cancellationToken);
        if (cdoUserIds.Count == 0) return;

        var po = poNumber.Trim();
        await _notifications.CreateForUsersAsync(
            cdoUserIds,
            new CreateUserNotificationRequest
            {
                Title = "أمر عمل جديد",
                Body = $"سُجّل أمر العمل {po} — {propertyCount} عقار.",
                Tone = "info",
                Href = $"/po/{Uri.EscapeDataString(po)}/property",
                Category = "workflow",
                EntityType = "work-order",
                EntityId = po,
                SourceEvent = $"work-order-created:{po}",
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
}
