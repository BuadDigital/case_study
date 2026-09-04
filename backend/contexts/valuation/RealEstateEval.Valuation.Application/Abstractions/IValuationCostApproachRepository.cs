using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Persistence boundary for the contractor cost approach. <c>ValuationCostApproachService</c>
/// in <c>Valuation.Application</c> owns the scaffold, validation and depreciation rules; only
/// the adapter opens <c>ValuationDbContext</c> (solid-scorecard finding 1).
/// </summary>
public interface IValuationCostApproachRepository
{
    /// <summary>Untracked valuation request, or <c>null</c> when it does not exist.</summary>
    Task<ValuationRequest?> GetRequestAsync(Guid valuationRequestId, CancellationToken cancellationToken);

    /// <summary>Untracked cost approach with its direct lines and indirect items.</summary>
    Task<ValuationCostApproach?> GetWithItemsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>Tracked cost approach with its direct lines and indirect items, for the save.</summary>
    Task<ValuationCostApproach?> FindWithItemsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    /// <summary>Untracked applied-approach settings (spec b-2), or <c>null</c> before first save.</summary>
    Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken);

    Task AddAsync(ValuationCostApproach entity, CancellationToken cancellationToken);

    Task AddLineAsync(ValuationCostLine line, CancellationToken cancellationToken);

    /// <summary>Deletes the direct lines the incoming payload no longer carries.</summary>
    Task RemoveLinesAsync(
        IReadOnlyCollection<ValuationCostLine> lines,
        CancellationToken cancellationToken);

    Task AddIndirectItemAsync(ValuationIndirectCostItem item, CancellationToken cancellationToken);

    /// <summary>Deletes the indirect items the incoming payload no longer carries.</summary>
    Task RemoveIndirectItemsAsync(
        IReadOnlyCollection<ValuationIndirectCostItem> items,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
