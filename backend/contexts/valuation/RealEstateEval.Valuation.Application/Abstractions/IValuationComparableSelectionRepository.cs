// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D7   GetCostApartmentLandShareSqmAsync — reads the apartment's land share (m²) saved on the cost
//         approach, the land area the cost approach values.
// Round 2 (1b19bedc)
//  • A    Replaced by GetCostLandAreasAsync (CostLandAreas): the building plot area and the apartment's land
//         share — the cost land table compares with the plot and multiplies by the share.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Persistence boundary for the market-approach comparable selections, their adjustment lines,
/// the market-approach header and the per-factor rationales.
/// <c>ValuationComparableSelectionService</c> in <c>Valuation.Application</c> owns selection,
/// adoption and adjustment rules; only the adapter opens <c>ValuationDbContext</c>
/// (solid-scorecard finding 1).
/// </summary>
public interface IValuationComparableSelectionRepository
{
    /// <summary>Untracked valuation request, or <c>null</c> when it does not exist.</summary>
    Task<ValuationRequest?> GetRequestAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>
    /// Drops demo-bank rows the valuer never adopted (no <c>SelectedByUserId</c>).
    /// Opening a valuation must not keep TRX-24-0912 / OFR-25-0206 planted on the matrix.
    /// </summary>
    Task DetachUnchosenDemoSelectionsAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>Untracked selections of one context with their adjustment lines, in sort order.</summary>
    Task<IReadOnlyList<ValuationComparableSelection>> ListSelectionsAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken);

    /// <summary>Tracked selections of one context, no lines loaded — the replace path.</summary>
    Task<IReadOnlyList<ValuationComparableSelection>> FindSelectionsAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken);

    /// <summary>Untracked comparables by id, keyed by id; missing ids are simply absent.</summary>
    Task<IReadOnlyDictionary<Guid, ComparableProperty>> GetComparablesAsync(
        IReadOnlyCollection<Guid> comparableIds,
        CancellationToken cancellationToken);

    /// <summary>Which of the given comparables are active — the selection validity check.</summary>
    Task<IReadOnlyList<Guid>> ListActiveComparableIdsAsync(
        IReadOnlyCollection<Guid> comparableIds,
        CancellationToken cancellationToken);

    /// <summary>Untracked active comparable, or <c>null</c> when missing or deactivated.</summary>
    Task<ComparableProperty?> GetActiveComparableAsync(
        Guid comparablePropertyId,
        CancellationToken cancellationToken);

    /// <summary>Untracked market-approach header, or <c>null</c> before the first save.</summary>
    Task<ValuationMarketApproach?> GetMarketApproachAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>Tracked market-approach header for the save path.</summary>
    Task<ValuationMarketApproach?> FindMarketApproachAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    Task<bool> MarketApproachExistsAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    Task AddMarketApproachAsync(ValuationMarketApproach header, CancellationToken cancellationToken);

    /// <summary>Untracked factor rationales of one context, ordered by factor key (ق-8-1).</summary>
    Task<IReadOnlyList<ValuationAdjustmentFactorRationale>> ListFactorRationalesAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken);

    /// <summary>Tracked factor rationale for one factor, or <c>null</c> when never saved.</summary>
    Task<ValuationAdjustmentFactorRationale?> FindFactorRationaleAsync(
        Guid valuationRequestId,
        string selectionContext,
        string factorKey,
        CancellationToken cancellationToken);

    Task AddFactorRationaleAsync(
        ValuationAdjustmentFactorRationale rationale,
        CancellationToken cancellationToken);

    Task RemoveFactorRationaleAsync(
        ValuationAdjustmentFactorRationale rationale,
        CancellationToken cancellationToken);

    /// <summary>Untracked applied-approach settings (spec b-2), or <c>null</c> before first save.</summary>
    Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Decision A: the building plot and the apartment's land share saved on the cost approach — what the
    /// land table inside the cost approach compares with and multiplies by (both null before a cost save).
    /// </summary>
    Task<CostLandAreas> GetCostLandAreasAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>Tracked selection with its adjustment lines, addressed by comparable.</summary>
    Task<ValuationComparableSelection?> FindSelectionByComparableAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        string selectionContext,
        bool includeLines,
        CancellationToken cancellationToken);

    /// <summary>Tracked selection with its adjustment lines, addressed by selection id.</summary>
    Task<ValuationComparableSelection?> FindSelectionAsync(
        Guid valuationRequestId,
        Guid selectionId,
        CancellationToken cancellationToken);

    /// <summary>Untracked selection with its adjustment lines, for the response payload.</summary>
    Task<ValuationComparableSelection?> GetSelectionAsync(
        Guid selectionId,
        CancellationToken cancellationToken);

    /// <summary>Highest sort order already used in this context, or <c>-1</c> when empty.</summary>
    Task<int> MaxSortOrderAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken);

    Task AddSelectionAsync(ValuationComparableSelection selection, CancellationToken cancellationToken);

    Task RemoveSelectionAsync(ValuationComparableSelection selection, CancellationToken cancellationToken);

    Task RemoveSelectionsAsync(
        IReadOnlyCollection<ValuationComparableSelection> selections,
        CancellationToken cancellationToken);

    /// <summary>
    /// Adds adjustment lines through the set rather than the navigation: a navigation-add with a
    /// pre-generated key is treated by EF as an update of a missing row (UPDATE hits 0 rows).
    /// </summary>
    Task AddAdjustmentLinesAsync(
        IReadOnlyCollection<ValuationComparableAdjustmentLine> lines,
        CancellationToken cancellationToken);

    Task RemoveAdjustmentLinesAsync(
        IReadOnlyCollection<ValuationComparableAdjustmentLine> lines,
        CancellationToken cancellationToken);

    /// <summary>Comparables pinned to the property during field work, oldest link first.</summary>
    Task<IReadOnlyList<Guid>> ListPropertyLinkedComparableIdsAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Saves the rows that every first open of a request seeds (imported comparable selections, their standard
    /// adjustment lines and the market-approach header).
    ///
    /// How it works: a normal save; if it fails on a unique index, the pending inserts are detached and
    /// <c>false</c> is returned, otherwise <c>true</c>.
    ///
    /// Edge cases and how it got fixed: the selections read and the reconciliation read both seed on the first
    /// open of a request and run at the same time. The loser used to hit the unique index and answer 500 (the screen
    /// showed «تعذّر تحميل المقارنات المختارة» until a reload). Any other database error is NOT swallowed.
    /// </summary>
    Task<bool> TrySaveSeedAsync(CancellationToken cancellationToken);
}
