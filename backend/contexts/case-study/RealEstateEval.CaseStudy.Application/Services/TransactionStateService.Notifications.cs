using RealEstateEval.Application;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class TransactionStateService
{
    /// <summary>
    /// Tells the finance team that a deed was handed over to Enfaz, so they know to watch for its financial data.
    /// </summary>
    /// <remarks>
    /// How it works: finds every user of the finance role, then sends them the notice that
    /// <see cref="EnfazHandoverNotificationRules"/> builds for this deed.
    /// Edge cases and how they were fixed: the handover used to tell nobody, and the accountant only found new
    /// deeds by opening the finance screen (the 30-day stall clock was already running). Best-effort: no finance
    /// user, no notification service, or a failure to send never fails the handover, which is already saved.
    /// </remarks>
    private async Task NotifyFinanceOfHandoverAsync(
        Guid workOrderId,
        WorkOrderProperty property,
        CancellationToken cancellationToken)
    {
        if (notifications is null || recipients is null) return;
        try
        {
            var userIds = await recipients.ResolveUserIdsWithPrototypeRoleAsync(
                EnfazHandoverNotificationRules.RecipientRole,
                cancellationToken);
            if (userIds.Count == 0) return;

            var poNumber = await db.GetPoNumberAsync(workOrderId, cancellationToken);
            var notice = EnfazHandoverNotificationRules.Build(
                property.Id,
                poNumber,
                property.DeedNumber,
                property.RealEstateRegNumber,
                property.EnfazHandoverAtUtc ?? _time.UtcNow());

            await notifications.CreateForUsersAsync(userIds, notice, cancellationToken);
        }
        catch
        {
            // The handover is saved — a failed notification does not undo it.
        }
    }
}
