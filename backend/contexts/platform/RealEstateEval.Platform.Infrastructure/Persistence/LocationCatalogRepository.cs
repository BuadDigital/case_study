using Microsoft.EntityFrameworkCore;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;

namespace RealEstateEval.Platform.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="ILocationCatalogRepository"/>. The only place the regions/cities
/// catalog use case reaches <see cref="PlatformDbContext"/>.
/// </summary>
public sealed class LocationCatalogRepository(PlatformDbContext db) : ILocationCatalogRepository
{
    private const int CitySearchCap = 200;
    private const int DistrictSearchCap = 100;

    public Task<int> CountOfficialSearchableCitiesAsync(CancellationToken cancellationToken) =>
        db.Cities.CountAsync(
            c => c.OfficialId != null && c.IsActive && c.NameSearch != "",
            cancellationToken);

    public Task<int> CountActiveRegionsAsync(CancellationToken cancellationToken) =>
        db.Regions.CountAsync(r => r.IsActive, cancellationToken);

    public async Task<IReadOnlyList<Region>> ListAllRegionsAsync(
        CancellationToken cancellationToken) =>
        await db.Regions.ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<City>> ListAllCitiesAsync(CancellationToken cancellationToken) =>
        await db.Cities.ToListAsync(cancellationToken);

    public Task AddRegionAsync(Region region, CancellationToken cancellationToken)
    {
        db.Regions.Add(region);
        return Task.CompletedTask;
    }

    public Task AddCityAsync(City city, CancellationToken cancellationToken)
    {
        db.Cities.Add(city);
        return Task.CompletedTask;
    }

    public Task AddDistrictAsync(District district, CancellationToken cancellationToken)
    {
        db.Districts.Add(district);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken) =>
        await db.Regions.AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.OfficialId)
            .Select(r => new SelectableRegionDto
            {
                Id = r.Id,
                OfficialId = r.OfficialId,
                Code = r.Code,
                NameAr = r.NameAr,
                CapitalAr = r.CapitalAr,
            })
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<SelectableCityDto>> ListSelectableCitiesAsync(
        CancellationToken cancellationToken) =>
        await db.Cities.AsNoTracking()
            .Where(c =>
                c.IsActive
                && c.Status != LocationCatalogStatuses.Merged
                && c.Region != null
                && c.Region.IsActive)
            .OrderByDescending(c => c.IsGovernorate)
            .ThenByDescending(c => c.IsCapital)
            .ThenBy(c => c.NameAr)
            .Select(c => new SelectableCityDto
            {
                Id = c.Id,
                OfficialId = c.OfficialId,
                RegionId = c.RegionId,
                NameAr = c.NameAr,
                NameEn = c.NameEn,
                IsCapital = c.IsCapital,
                IsGovernorate = c.IsGovernorate,
                Status = c.Status,
                RegionNameAr = c.Region!.NameAr,
            })
            .ToListAsync(cancellationToken);

    public Task<ActiveRegionSummary?> FindActiveRegionSummaryAsync(
        Guid regionId,
        CancellationToken cancellationToken) =>
        db.Regions.AsNoTracking()
            .Where(r => r.Id == regionId && r.IsActive)
            .Select(r => new ActiveRegionSummary(r.Id, r.NameAr))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<City>> SearchCitiesAsync(
        Guid regionId,
        string? normalizedQuery,
        string? rawQuery,
        CancellationToken cancellationToken)
    {
        var cities = db.Cities.AsNoTracking()
            .Where(c =>
                c.RegionId == regionId
                && c.IsActive
                && c.Status != LocationCatalogStatuses.Merged);

        if (string.IsNullOrEmpty(normalizedQuery))
        {
            cities = cities.Where(c =>
                c.IsGovernorate || c.Status == LocationCatalogStatuses.Pending);
        }
        else
        {
            var raw = (rawQuery ?? "").Trim();
            cities = cities.Where(c =>
                c.NameSearch.Contains(normalizedQuery) || c.NameAr.Contains(raw));
        }

        return await cities
            .OrderByDescending(c => c.Status == LocationCatalogStatuses.Approved)
            .ThenByDescending(c => c.IsGovernorate)
            .ThenByDescending(c => c.IsCapital)
            .ThenBy(c => c.NameAr)
            .Take(CitySearchCap)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableDistrictDto>> SearchDistrictsAsync(
        Guid cityId,
        string? normalizedQuery,
        string? rawQuery,
        CancellationToken cancellationToken)
    {
        var districts = db.Districts.AsNoTracking()
            .Where(d =>
                d.CityId == cityId
                && d.IsActive
                && d.Status != LocationCatalogStatuses.Merged);

        if (!string.IsNullOrEmpty(normalizedQuery))
        {
            var raw = (rawQuery ?? "").Trim();
            districts = districts.Where(d =>
                d.NameSearch.Contains(normalizedQuery) || d.NameAr.Contains(raw));
        }

        return await districts
            .OrderByDescending(d => d.Status == LocationCatalogStatuses.Approved)
            .ThenBy(d => d.NameAr)
            .Take(DistrictSearchCap)
            .Select(d => new SelectableDistrictDto
            {
                Id = d.Id,
                CityId = d.CityId,
                NameAr = d.NameAr,
                Status = d.Status,
            })
            .ToListAsync(cancellationToken);
    }

    public Task<bool> IsCitySelectableAsync(Guid cityId, CancellationToken cancellationToken) =>
        db.Cities.AnyAsync(
            c => c.Id == cityId && c.IsActive && c.Status != LocationCatalogStatuses.Merged,
            cancellationToken);

    public async Task<IReadOnlyList<District>> ListSelectableDistrictsAsync(
        Guid cityId,
        CancellationToken cancellationToken) =>
        await db.Districts
            .Where(d =>
                d.CityId == cityId
                && d.IsActive
                && d.Status != LocationCatalogStatuses.Merged)
            .ToListAsync(cancellationToken);

    public Task<Region?> GetActiveRegionAsync(Guid regionId, CancellationToken cancellationToken) =>
        db.Regions.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == regionId && r.IsActive, cancellationToken);

    public async Task<IReadOnlyList<City>> ListSelectableCitiesAsync(
        Guid regionId,
        CancellationToken cancellationToken) =>
        await db.Cities
            .Where(c =>
                c.RegionId == regionId
                && c.IsActive
                && c.Status != LocationCatalogStatuses.Merged)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PendingLocationDto>> ListPendingCitiesAsync(
        CancellationToken cancellationToken) =>
        await db.Cities.AsNoTracking()
            .Where(c => c.Status == LocationCatalogStatuses.Pending && c.IsActive)
            .OrderByDescending(c => c.UsageCount)
            .ThenByDescending(c => c.CreatedAtUtc)
            .Select(c => new PendingLocationDto
            {
                Id = c.Id,
                Kind = "city",
                NameAr = c.NameAr,
                RawInput = c.RawInput,
                ScopeLabel = c.Region != null ? c.Region.NameAr : "",
                UsageCount = c.UsageCount,
                CreatedByUserId = c.CreatedByUserId,
                CreatedAtUtc = c.CreatedAtUtc,
            })
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PendingLocationDto>> ListPendingDistrictsAsync(
        CancellationToken cancellationToken) =>
        await db.Districts.AsNoTracking()
            .Where(d => d.Status == LocationCatalogStatuses.Pending && d.IsActive)
            .OrderByDescending(d => d.UsageCount)
            .ThenByDescending(d => d.CreatedAtUtc)
            .Select(d => new PendingLocationDto
            {
                Id = d.Id,
                Kind = "district",
                NameAr = d.NameAr,
                RawInput = d.RawInput,
                ScopeLabel = d.City != null ? d.City.NameAr : "",
                UsageCount = d.UsageCount,
                CreatedByUserId = d.CreatedByUserId,
                CreatedAtUtc = d.CreatedAtUtc,
            })
            .ToListAsync(cancellationToken);

    public Task<City?> FindCityAsync(Guid cityId, CancellationToken cancellationToken) =>
        db.Cities.FirstOrDefaultAsync(c => c.Id == cityId, cancellationToken);

    public Task<City?> FindActiveCityAsync(Guid cityId, CancellationToken cancellationToken) =>
        db.Cities.FirstOrDefaultAsync(c => c.Id == cityId && c.IsActive, cancellationToken);

    public Task<District?> FindDistrictAsync(Guid districtId, CancellationToken cancellationToken) =>
        db.Districts.FirstOrDefaultAsync(d => d.Id == districtId, cancellationToken);

    public Task<District?> FindActiveDistrictAsync(
        Guid districtId,
        CancellationToken cancellationToken) =>
        db.Districts.FirstOrDefaultAsync(d => d.Id == districtId && d.IsActive, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
