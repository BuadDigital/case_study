using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Abstractions;

/// <summary>The two region fields the city search needs; the aggregate is never materialised.</summary>
public sealed record ActiveRegionSummary(Guid Id, string NameAr);

/// <summary>
/// Persistence boundary for the regions / cities / districts catalog. <c>RegionsService</c> in
/// <c>Platform.Application</c> owns seeding reconciliation, the suggestion and review rules, and
/// cache invalidation; only the adapter opens <c>PlatformDbContext</c> (solid-scorecard
/// finding 1).
/// </summary>
/// <remarks>
/// The read-model lists come back as DTOs because they are projected in the database — the
/// catalog is thousands of rows and the use case only forwards them. Everything the use case
/// mutates comes back as a tracked entity instead.
/// </remarks>
public interface ILocationCatalogRepository
{
    /// <summary>Active cities already carrying an official id and a search key — the seed fast path.</summary>
    Task<int> CountOfficialSearchableCitiesAsync(CancellationToken cancellationToken);

    Task<int> CountActiveRegionsAsync(CancellationToken cancellationToken);

    /// <summary>Tracked regions — the seed reconciliation working set.</summary>
    Task<IReadOnlyList<Region>> ListAllRegionsAsync(CancellationToken cancellationToken);

    /// <summary>Tracked cities — the seed reconciliation working set.</summary>
    Task<IReadOnlyList<City>> ListAllCitiesAsync(CancellationToken cancellationToken);

    Task AddRegionAsync(Region region, CancellationToken cancellationToken);

    Task AddCityAsync(City city, CancellationToken cancellationToken);

    Task AddDistrictAsync(District district, CancellationToken cancellationToken);

    /// <summary>Active regions in official order, for the selector.</summary>
    Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken);

    /// <summary>Every selectable city of every active region, governorates and capitals first.</summary>
    Task<IReadOnlyList<SelectableCityDto>> ListSelectableCitiesAsync(
        CancellationToken cancellationToken);

    Task<ActiveRegionSummary?> FindActiveRegionSummaryAsync(
        Guid regionId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Untracked city search inside one region, capped at 200. A blank
    /// <paramref name="normalizedQuery"/> lists governorates and pending rows;
    /// otherwise the search key and the raw Arabic name are both matched.
    /// </summary>
    Task<IReadOnlyList<City>> SearchCitiesAsync(
        Guid regionId,
        string? normalizedQuery,
        string? rawQuery,
        CancellationToken cancellationToken);

    /// <summary>Untracked district search inside one city, capped at 100.</summary>
    Task<IReadOnlyList<SelectableDistrictDto>> SearchDistrictsAsync(
        Guid cityId,
        string? normalizedQuery,
        string? rawQuery,
        CancellationToken cancellationToken);

    /// <summary>True when the city exists, is active and has not been merged away.</summary>
    Task<bool> IsCitySelectableAsync(Guid cityId, CancellationToken cancellationToken);

    /// <summary>Tracked, non-merged, active districts of one city — the duplicate check.</summary>
    Task<IReadOnlyList<District>> ListSelectableDistrictsAsync(
        Guid cityId,
        CancellationToken cancellationToken);

    /// <summary>Untracked active region, or <c>null</c>.</summary>
    Task<Region?> GetActiveRegionAsync(Guid regionId, CancellationToken cancellationToken);

    /// <summary>Tracked, non-merged, active cities of one region — the duplicate check.</summary>
    Task<IReadOnlyList<City>> ListSelectableCitiesAsync(
        Guid regionId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PendingLocationDto>> ListPendingCitiesAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<PendingLocationDto>> ListPendingDistrictsAsync(
        CancellationToken cancellationToken);

    Task<City?> FindCityAsync(Guid cityId, CancellationToken cancellationToken);

    /// <summary>Tracked active city — the merge target lookup.</summary>
    Task<City?> FindActiveCityAsync(Guid cityId, CancellationToken cancellationToken);

    Task<District?> FindDistrictAsync(Guid districtId, CancellationToken cancellationToken);

    /// <summary>Tracked active district — the merge target lookup.</summary>
    Task<District?> FindActiveDistrictAsync(Guid districtId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
