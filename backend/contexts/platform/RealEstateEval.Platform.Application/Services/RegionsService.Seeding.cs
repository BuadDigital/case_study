using RealEstateEval.Application;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Reconciles the shipped official catalog into the regions / cities tables: rows are matched
/// by official id, then by legacy code / seed Guid, and created otherwise; seeded cities the
/// payload no longer lists are deactivated (pending user rows are kept).
/// </summary>
public sealed partial class RegionsService
{
    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        var payload = _seed.Load();
        if (!LocationCatalogRules.HasUsableSeed(payload))
            return;

 // Fast path: official catalog already imported (3077) with search keys.
        var officialActive = await _repo.CountOfficialSearchableCitiesAsync(cancellationToken);
        var activeRegions = await _repo.CountActiveRegionsAsync(cancellationToken);
        if (LocationCatalogRules.CatalogAlreadyImported(payload, activeRegions, officialActive))
            return;

        var now = _time.UtcNow();
        var existingRegions = await _repo.ListAllRegionsAsync(cancellationToken);
        var regionsByOfficial = existingRegions.ToDictionary(r => r.OfficialId);
        var regionsByCode = existingRegions
            .GroupBy(r => r.Code, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var regionMap = new Dictionary<int, Guid>();
        var touchedOfficialCities = new HashSet<int>();

        foreach (var row in payload.Regions)
        {
            Region entity;
            if (regionsByOfficial.TryGetValue(row.Id, out var byOfficial))
            {
                entity = byOfficial;
            }
            else if (regionsByCode.TryGetValue(row.Code.Trim(), out var byCode))
            {
                entity = byCode;
                entity.OfficialId = row.Id;
            }
            else
            {
                entity = new Region
                {
                    Id = LocationCatalogRules.RegionSeedGuid(row.Id),
                    OfficialId = row.Id,
                    CreatedAtUtc = now,
                };
                await _repo.AddRegionAsync(entity, cancellationToken);
            }

            LocationCatalogRules.ApplySeedRegion(entity, row);
            regionMap[row.Id] = entity.Id;
        }

        var existingCities = await _repo.ListAllCitiesAsync(cancellationToken);
        var citiesByOfficial = existingCities
            .Where(c => c.OfficialId != null)
            .ToDictionary(c => c.OfficialId!.Value);
        var citiesById = existingCities.ToDictionary(c => c.Id);

        foreach (var row in payload.Cities)
        {
            if (!regionMap.TryGetValue(row.RegionId, out var regionId)) continue;
            touchedOfficialCities.Add(row.Id);

            var id = LocationCatalogRules.CitySeedGuid(row.Id);

            City entity;
            if (citiesByOfficial.TryGetValue(row.Id, out var byOfficial))
            {
                entity = byOfficial;
            }
            else if (citiesById.TryGetValue(id, out var byId))
            {
                entity = byId;
                entity.OfficialId = row.Id;
            }
            else
            {
                entity = new City
                {
                    Id = id,
                    OfficialId = row.Id,
                    CreatedAtUtc = now,
                    Status = LocationCatalogStatuses.Approved,
                };
                await _repo.AddCityAsync(entity, cancellationToken);
                citiesById[id] = entity;
            }

            LocationCatalogRules.ApplySeedCity(entity, row, regionId);
        }

 // Old v1 seeded cities that are not in the official catalog: deactivate (keep pending user rows).
        var currentSeedIds = payload.Cities
            .Select(c => LocationCatalogRules.CitySeedGuid(c.Id))
            .ToHashSet();
        foreach (var orphan in existingCities)
        {
            if (LocationCatalogRules.IsStaleSeededCity(orphan, touchedOfficialCities, currentSeedIds))
                orphan.IsActive = false;
        }

 // Backfill OfficialId on regions that were seeded before the column existed (matched by SeedGuid).
        foreach (var row in payload.Regions)
        {
            var expectedId = LocationCatalogRules.RegionSeedGuid(row.Id);
            var legacy = existingRegions.FirstOrDefault(r => r.Id == expectedId && r.OfficialId == 0);
            if (legacy is not null)
            {
                legacy.OfficialId = row.Id;
                legacy.AdminAreaId = row.AdminAreaId;
            }
        }

        await _repo.SaveChangesAsync(cancellationToken);
        await InvalidateCatalogCache(cancellationToken);
    }
}
