using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// Notification fan-out: review-stage notices go to every case-study specialist on the work
/// order; hold notices go to the one specialist whose task was blocked or unblocked.
/// </summary>
public partial class FailureService
{
    /// <summary>
    /// Notifies every case-study assignee on the work order. Silently skips when the order has
    /// no such assignee.
    /// </summary>
    private async Task NotifyPoSpecialistsAsync(
        string poNumber,
        CreateUserNotificationRequest notification,
        CancellationToken cancellationToken)
    {
        var recipientIds = await _recipients.ResolveAssigneeUserIdsForPoAsync(
            poNumber,
            [CaseStudyPropertyKind],
            cancellationToken);

        if (recipientIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            recipientIds,
            notification,
            cancellationToken);
    }

    private async Task NotifyHoldSpecialistAsync(
        string? assigneeId,
        CreateUserNotificationRequest notification,
        CancellationToken cancellationToken)
    {
        var trimmedAssigneeId = assigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            trimmedAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(userId, notification, cancellationToken);
    }
}
