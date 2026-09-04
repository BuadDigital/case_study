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
