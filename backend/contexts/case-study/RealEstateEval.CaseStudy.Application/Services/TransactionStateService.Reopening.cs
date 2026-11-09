using RealEstateEval.Application;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// «إعادة فتح المعاملة» around the reopen itself (<see cref="ReturnFromEnfazAsync"/>), Omar 2026-11-05: the
/// active reopening on the transaction state and its end at the next upload to Enfaz (Omar 2026-11-08: no
/// «تم الرد على إنفاذ» step — the reply to Enfaz happens outside the system).
/// </summary>
public sealed partial class TransactionStateService
{

    /// <summary>Every reopening not closed yet («أعمالي»: the reopened chip).</summary>
    public async Task<IReadOnlyList<TransactionReopeningDto>> ListActiveReopeningsAsync(
        CancellationToken cancellationToken = default) =>
        (await db.ListActiveReopeningsAsync(cancellationToken)).Select(ToReopeningDto).ToList();

    /// <summary>
    /// Adds the active reopening and whether a new one may open now to the transaction state.
    /// </summary>
    /// <remarks>
    /// How it works: reads the transaction's active reopening; «may reopen» = uploaded to Enfaz or the
    /// valuation deposited, nothing active, not marked ready for billing.
    /// Edge cases: a deed with no transaction carries neither.
    /// </remarks>
    private async Task<TransactionStateDto> WithReopeningAsync(
        TransactionStateDto dto,
        TransactionStateRules.Input input,
        WorkOrderProperty property,
        CancellationToken cancellationToken)
    {
        if (property.TransactionId == Guid.Empty) return dto;
        var active = await db.GetActiveReopeningAsync(property.TransactionId, cancellationToken);
        dto.Reopening = active is null ? null : ToReopeningDto(active);
        dto.CanReopen = active is null
            && !property.IsBillingReady
            && (input.EnfazHandedOver || input.ValuationReportClosed);
        return dto;
    }

    /// <summary>The transaction went back to Enfaz: its open reopening closes, or waits for the reply.</summary>
    /// <remarks>Edge cases: no transaction or nothing open → nothing to do.</remarks>
    private async Task EndReopeningOnUploadAsync(WorkOrderProperty property, DateTime nowUtc, CancellationToken cancellationToken)
    {
        if (property.TransactionId == Guid.Empty) return;
        var active = await db.GetActiveReopeningAsync(property.TransactionId, cancellationToken);
        if (active is not null && active.MarkUploadedAgain(nowUtc))
            await db.SaveChangesAsync(cancellationToken);
    }

    private static TransactionReopeningDto ToReopeningDto(TransactionReopening r) => new()
    {
        Id = r.Id,
        TransactionId = r.TransactionId,
        PropertyId = r.PropertyId,
        Source = r.Source,
        SourceLabelAr = TransactionReopeningSources.LabelAr(r.Source),
        EnfazReference = r.EnfazReference,
        Reason = r.Reason,
        ReopensStudy = r.ReopensStudy,
        ReopensValuation = r.ReopensValuation,
        NeedsFieldWork = r.NeedsFieldWork,
        AffectedLabelAr = r.AffectedLabelAr(),
        Status = r.Status,
        OpenedAtUtc = r.OpenedAtUtc.ToString("o"),
        OpenedByName = r.OpenedByName,
        UploadedAgainAtUtc = r.UploadedAgainAtUtc?.ToString("o"),
    };
}
