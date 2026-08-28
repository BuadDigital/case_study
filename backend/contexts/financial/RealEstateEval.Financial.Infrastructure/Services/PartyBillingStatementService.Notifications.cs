using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Financial.Infrastructure.Services;

public partial class PartyBillingStatementService
{
    private async Task<string> NextReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
 // ورشة الترقيم (بندا البتّ 1–2): مسير الصرف DS-{سنة}-{تسلسل ٥} بتخصيص محلي —
 // المراجع الصادرة قبل التفعيل (FN-CS-…) تبقى كما هي ولا تُعاد صياغتها.
        var (reference, error) = await ReferenceSequenceAllocator.AllocateYearlyAsync(
            _db,
            DatabaseSchemas.Financial,
            ReferenceNumbering.DisbursementStatement,
            nowUtc,
            cancellationToken);
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
