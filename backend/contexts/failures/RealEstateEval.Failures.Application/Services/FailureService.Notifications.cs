using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Failures.Application.Services;

/// <summary>
/// Notification fan-out: the case specialist's failure notices go to the coordination sub-role,
/// which follows every failure (ruling 2026-11-02); party notices go to the party's assignee.
/// </summary>
public partial class FailureService
{
    /// <summary>
    /// Notifies every active case specialist holding the coordination sub-role (the work order no
    /// longer names its specialist). How it works: one sub-role broadcast; the work order is kept
    /// for the callers' wording only. Edge cases: nobody holding the sub-role → silently skipped.
    /// </summary>
    private async Task NotifyPoSpecialistsAsync(
        string poNumber,
        CreateUserNotificationRequest notification,
        CancellationToken cancellationToken)
    {
        var recipientIds = await _recipients.ResolveCaseSpecialistUserIdsAsync(
            CaseSpecialistAudience.Operations,
            cancellationToken);

        if (recipientIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            recipientIds,
            notification,
            cancellationToken);
    }

    /// <summary>
    /// A hold blocked or unblocked the case-study task: coordination hears it (the task itself names
    /// nobody any more). Edge cases: nobody holding the sub-role → silently skipped.
    /// </summary>
    private async Task NotifyCoordinationAsync(
        CreateUserNotificationRequest notification,
        CancellationToken cancellationToken)
    {
        var recipientIds = await _recipients.ResolveCaseSpecialistUserIdsAsync(
            CaseSpecialistAudience.Operations,
            cancellationToken);
        if (recipientIds.Count == 0) return;
        await _notifications.CreateForUsersAsync(recipientIds, notification, cancellationToken);
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
