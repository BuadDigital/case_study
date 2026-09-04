using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Persistence boundary for the final reconciliation of approach values.
/// <c>ValuationReconciliationService</c> in <c>Valuation.Application</c> owns the
/// participation, weighting, rounding and liquidation rules; only the adapter opens
/// <c>ValuationDbContext</c> (solid-scorecard finding 1).
/// </summary>
public interface IValuationReconciliationRepository
{
    /// <summary>Untracked valuation request, or <c>null</c> when it does not exist.</summary>
    Task<ValuationRequest?> GetRequestAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>Untracked reconciliation with its per-approach weighting lines.</summary>
    Task<ValuationReconciliation?> GetWithMethodsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>Tracked reconciliation with its weighting lines, for the save.</summary>
    Task<ValuationReconciliation?> FindWithMethodsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>Untracked applied-approach settings (spec b-2), or <c>null</c> before first save.</summary>
    Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    Task AddAsync(ValuationReconciliation entity, CancellationToken cancellationToken);

    /// <summary>
    /// Adds one weighting line. Lines are added through the set rather than the navigation:
    /// a navigation-add with a pre-set key is marked Modified by EF's graph heuristic and the
    /// re-save then updates zero rows.
    /// </summary>
    Task AddMethodLineAsync(
        ValuationReconciliationMethodLine line,
        CancellationToken cancellationToken);

    /// <summary>Deletes the weighting lines the incoming payload no longer carries.</summary>
    Task RemoveMethodLinesAsync(
        IReadOnlyCollection<ValuationReconciliationMethodLine> lines,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
