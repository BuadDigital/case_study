namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Backfills missing court-visit fee charges for completed cooperator visits. Implemented by
/// the Operations context's visit-fee helper; the financial billing-statement service takes
/// this abstraction so the concrete helper can live in the Operations slice.
/// </summary>
public interface ICourtVisitFeeBackfill
{
    Task<int> BackfillMissingChargesForCompletedVisitsAsync(
        CancellationToken cancellationToken = default);
}
