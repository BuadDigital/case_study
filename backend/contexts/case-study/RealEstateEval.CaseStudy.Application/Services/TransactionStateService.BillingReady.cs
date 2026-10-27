using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class TransactionStateService
{
    /// <summary>Why a marked deed cannot be taken back from Enfaz.</summary>
    public const string BillingReadyBlocksReturnAr =
        "الصك موسوم «جاهز للفوترة» — ظهرت بياناته المالية على إنفاذ فلا يُسترجع للتعديل";

    /// <summary>
    /// The accountant marks a handed-over deed «جاهز للفوترة» after its financial data appeared on Enfaz.
    /// Idempotent: a second mark keeps the first stamp. The mark is cleared whenever the handover is.
    /// </summary>
    /// <remarks>
    /// How it works: 1) loads the deed's facts (unknown deed → «المعاملة غير موجودة»). 2) Remembers whether it
    /// was already marked, then asks the entity to mark it (WorkOrderProperty.MarkBillingReady). 3) A refusal
    /// (not handed over, removed) comes back as the Arabic error with nothing saved. 4) Only a NEW mark is
    /// saved and recorded (audit + timeline); then the fresh transaction state is returned so the screen
    /// updates without a second request.
    /// Edge cases: a repeat mark succeeds without a second save, audit entry or timeline entry; audit and
    /// timeline failures are swallowed on purpose because the mark is already saved and must not be
    /// reported as failed; the role check is the controller's (CanMarkBillingReady), not this service's.
    /// </remarks>
    public async Task<(TransactionStateDto? Result, string? Error)> MarkBillingReadyAsync(
        Guid workOrderId,
        Guid propertyId,
        string? markedByUserId,
        CancellationToken cancellationToken = default)
    {
        var facts = await LoadFactsAsync(workOrderId, propertyId, cancellationToken);
        if (facts is null) return (null, "المعاملة غير موجودة");

        var (input, hasSurvey, property) = facts.Value;
        var wasMarked = property.IsBillingReady;
        var now = _time.UtcNow();
        var error = property.MarkBillingReady(markedByUserId, now);
        if (error is not null) return (null, error);

        if (!wasMarked)
        {
            await db.SaveChangesAsync(cancellationToken);
            await RecordBillingReadyAsync(workOrderId, propertyId, property, markedByUserId, cancellationToken);
        }

        return (ToDto(workOrderId, propertyId, input, hasSurvey, property), null);
    }

    private async Task RecordBillingReadyAsync(
        Guid workOrderId,
        Guid propertyId,
        WorkOrderProperty property,
        string? markedByUserId,
        CancellationToken cancellationToken)
    {
        if (audit is not null && auditLog is not null)
        {
            try
            {
                await auditLog.AppendAsync(audit.Create(
                    actorId: string.IsNullOrWhiteSpace(markedByUserId) ? "unknown" : markedByUserId.Trim(),
                    action: "case-study.billing-ready.marked",
                    entityType: "WorkOrderProperty",
                    entityId: propertyId.ToString("D"),
                    before: new { billingReady = false },
                    after: new { billingReady = true, workOrderId, property.EnfazHandoverAtUtc }),
                    cancellationToken);
            }
            catch
            {
                // The mark is saved — a failed audit append does not undo it.
            }
        }

        try
        {
            var poNumber = await db.GetPoNumberAsync(workOrderId, cancellationToken) ?? "";
            var at = property.BillingReadyAtUtc ?? _time.UtcNow();
            await timeline.RecordAsync(
                poNumber,
                propertyId,
                $"billing_ready:{at.Ticks}",
                "وُسم الصك «جاهز للفوترة»",
                "ظهرت بياناته المالية على إنفاذ",
                PropertyTimelineTones.Done,
                at,
                cancellationToken);
        }
        catch
        {
            // The timeline entry is informational.
        }
    }
}
