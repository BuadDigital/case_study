// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income New file — persistence boundary for the income approach: request, income row
//           (untracked / tracked), approach settings, add and save.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Persistence boundary for the income approach. <c>ValuationIncomeApproachService</c> owns
/// the validation and the capitalisation chain; only the adapter opens <c>ValuationDbContext</c>.
/// </summary>
public interface IValuationIncomeApproachRepository
{
    /// <summary>Untracked valuation request, or <c>null</c> when it does not exist.</summary>
    Task<ValuationRequest?> GetRequestAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>Untracked income approach, or <c>null</c> before the first save.</summary>
    Task<ValuationIncomeApproach?> GetAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>Tracked income approach, for the save.</summary>
    Task<ValuationIncomeApproach?> FindAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>Untracked applied-approach settings, or <c>null</c> before first save.</summary>
    Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    Task AddAsync(ValuationIncomeApproach entity, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
