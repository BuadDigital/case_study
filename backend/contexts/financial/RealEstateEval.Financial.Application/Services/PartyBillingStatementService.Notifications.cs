using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Services;

public partial class PartyBillingStatementService
{
    private async Task<string> NextReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
 // Numbering workshop (decision items 1–2): disbursement slip DS-{year}-{5-digit seq} assigned locally —
 // references issued before go-live (FN-CS-…) stay as-is and are not reformatted.
        var (reference, error) = await _db.AllocateStatementReferenceAsync(nowUtc, cancellationToken);
        if (error is not null)
            throw new InvalidOperationException(error);
        if (string.IsNullOrWhiteSpace(reference))
            throw new InvalidOperationException("تعذّر توليد رقم كشف الفوترة.");
        return reference;
    }

    private async Task NotifyStatementIssuedAsync(
        PartyBillingStatement statement,
        int lineCount,
        CancellationToken cancellationToken)
    {
        var supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "section-supervisor",
            cancellationToken);
        if (supervisors.Count > 0)
        {
            await _notifications.CreateForUsersAsync(
                supervisors,
                new CreateUserNotificationRequest
                {
                    Title = "إصدار كشف فوترة مكتب هندسي",
                    Body = $"صدر الكشف {statement.ReferenceNumber} ({lineCount} بند) — للاطلاع.",
                    Tone = "info",
                    Href = "/party-fees?variant=engineering-survey",
                    Category = "financial",
                    SourceEvent = $"eng-billing-issued:{statement.Id}",
                },
                cancellationToken);
        }

        var officeUserId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            statement.AssigneeId,
            cancellationToken);
        if (officeUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                officeUserId,
                new CreateUserNotificationRequest
                {
                    Title = "كشف فوترة صادر",
                    Body = $"وصلك الكشف {statement.ReferenceNumber} للاطلاع ({lineCount} بند).",
                    Tone = "info",
                    Href = "/party-fees?variant=engineering-survey",
                    Category = "financial",
                    SourceEvent = $"eng-billing-issued-office:{statement.Id}",
                },
                cancellationToken);
        }
    }

    private async Task NotifyStatementClosedAsync(
        PartyBillingStatement statement,
        int lineCount,
        CancellationToken cancellationToken)
    {
        var officeUserId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            statement.AssigneeId,
            cancellationToken);
        if (officeUserId is null) return;

        await _notifications.CreateForUserAsync(
            officeUserId,
            new CreateUserNotificationRequest
            {
                Title = "تم صرف كشف الفوترة",
                Body = $"أُقفل الكشف {statement.ReferenceNumber} كمصروف ({lineCount} بند).",
                Tone = "success",
                Href = "/party-fees?variant=engineering-survey",
                Category = "financial",
                SourceEvent = $"eng-billing-closed:{statement.Id}",
            },
            cancellationToken);
    }
}
