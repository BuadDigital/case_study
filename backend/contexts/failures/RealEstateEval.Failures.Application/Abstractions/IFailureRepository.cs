using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Abstractions;

/// <summary>
/// Persistence boundary for property failures. <c>FailureService</c> in
/// <c>Failures.Application</c> owns the lifecycle, visibility and side-effect orchestration;
/// only the adapter opens <c>FailuresDbContext</c> (solid-scorecard finding 1).
/// </summary>
/// <remarks>
/// Reads named <c>Find*</c> come back tracked so the domain <c>Try*</c> transitions can be
/// applied and persisted by <see cref="SaveChangesAsync"/>; <c>List*</c>/<c>Get*</c> are
/// untracked reads for display.
/// </remarks>
public interface IFailureRepository
{
    /// <summary>
    /// Untracked failures, newest update first, capped at <paramref name="max"/>. A non-null
    /// <paramref name="visiblePoNumbers"/> narrows the page to the actor's work orders; an
    /// empty one returns nothing.
    /// </summary>
    Task<IReadOnlyList<PropertyFailure>> ListRecentAsync(
        IReadOnlyCollection<string>? visiblePoNumbers,
        int max,
        CancellationToken cancellationToken);

    /// <summary>
    /// One filtered, sorted window of the queue. Visibility is part of the same query, so
    /// <see cref="CountAsync"/> is the actor's total.
    /// See docs/architecture/pagination-contract.md §5.
    /// </summary>
    Task<IReadOnlyList<PropertyFailure>> ListPageAsync(
        IReadOnlyCollection<string>? visiblePoNumbers,
        FailureListQuery query,
        int skip,
        int take,
        CancellationToken cancellationToken);

    /// <summary>Rows matching the same filters and visibility, counted before the window.</summary>
    Task<int> CountAsync(
        IReadOnlyCollection<string>? visiblePoNumbers,
        FailureListQuery query,
        CancellationToken cancellationToken);

    /// <summary>Tracked failure by id — every lifecycle transition loads through here.</summary>
    Task<PropertyFailure?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Untracked newest active failure of one property, or <c>null</c>.</summary>
    Task<PropertyFailure?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);

    /// <summary>Tracked newest unresolved failure of one property — the hold upsert.</summary>
    Task<PropertyFailure?> FindLatestUnresolvedAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);

    /// <summary>Tracked eviction holds that are neither resolved nor approved.</summary>
    Task<IReadOnlyList<PropertyFailure>> FindOpenEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string problemTypeId,
        CancellationToken cancellationToken);

    /// <summary>Whether the property already carries an unresolved failure of any kind.</summary>
    Task<bool> HasUnresolvedAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken);

    Task AddAsync(PropertyFailure failure, CancellationToken cancellationToken);

    /// <summary>Set-based delete of every failure of a work order; no entity is materialised.</summary>
    Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
