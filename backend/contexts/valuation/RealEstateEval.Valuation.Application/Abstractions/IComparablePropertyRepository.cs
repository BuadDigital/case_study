using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>Bank listing filter. Blank members mean "no filter".</summary>
public sealed record ComparableBankFilter(
    bool IncludeInactive,
    string? District,
    string? City,
    string? TransactionKind,
    string? Source,
    string? IntakeChannel,
    string? PropertyType,
    string? Search,
    DateOnly? FromDate,
    DateOnly? ToDate);

/// <summary>Proximity-suggestion filter; tagged and inactive records are always excluded.</summary>
public sealed record ComparableProximityFilter(
    IReadOnlyCollection<Guid> ExcludeIds,
    string? District,
    string? PropertyType);

/// <summary>A coordinate pair shared by more than one active record.</summary>
public sealed record ComparableCoordinate(decimal Latitude, decimal Longitude);

/// <summary>
/// Persistence boundary for the comparable-properties bank. <c>ComparablePropertyService</c> in
/// <c>Valuation.Application</c> owns validation, ranking and the anomaly/duplicate advisories;
/// only the adapter opens <c>ValuationDbContext</c> (solid-scorecard finding 1).
/// </summary>
public interface IComparablePropertyRepository
{
    /// <summary>Untracked page of the bank, newest transaction first.</summary>
    Task<IReadOnlyList<ComparableProperty>> ListAsync(
        ComparableBankFilter filter,
        int take,
        CancellationToken cancellationToken);

    /// <summary>
    /// Coordinate pairs carried by more than one active record — location is the duplicate
    /// discriminator (ق-3/2), and the suspicion is advisory only.
    /// </summary>
    Task<IReadOnlyList<ComparableCoordinate>> ListDuplicateCoordinatesAsync(
        CancellationToken cancellationToken);

    /// <summary>Untracked record for display.</summary>
    Task<ComparableProperty?> GetAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Tracked record for edits.</summary>
    Task<ComparableProperty?> FindAsync(Guid id, CancellationToken cancellationToken);

    Task AddAsync(ComparableProperty entity, CancellationToken cancellationToken);

    /// <summary>Pins a field-captured comparable to the property it was captured on.</summary>
    Task AddLinkAsync(PropertyComparableLink link, CancellationToken cancellationToken);

    /// <summary>
    /// Untracked candidate pool for proximity ranking. Haversine is not portable across
    /// providers, so a wider pool is pulled and ranked in memory.
    /// </summary>
    Task<IReadOnlyList<ComparableProperty>> ListProximityPoolAsync(
        ComparableProximityFilter filter,
        int take,
        CancellationToken cancellationToken);

    /// <summary>Price-per-sqm of the district's other active records, newest first.</summary>
    Task<IReadOnlyList<decimal>> ListDistrictPeerPricesAsync(
        Guid excludeId,
        string district,
        int take,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
