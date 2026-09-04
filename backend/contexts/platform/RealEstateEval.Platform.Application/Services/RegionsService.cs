using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Regions / cities / districts catalog use case: reconciling the shipped official catalog,
/// the selector reads behind the response cache, user suggestions with fuzzy duplicate
/// detection, and the reviewer approve/rename/merge actions. Persistence goes through
/// <see cref="ILocationCatalogRepository"/> and the shipped payload through
/// <see cref="ILocationCatalogSeedSource"/>, so this file holds rules only - no EF
/// (solid-scorecard finding 1).
/// </summary>
public sealed class RegionsService : IRegionsService
{
    private readonly ILocationCatalogRepository _repo;
    private readonly ILocationCatalogSeedSource _seed;
    private readonly IResponseCache _cache;
    private readonly TimeProvider _time;

    public RegionsService(
        ILocationCatalogRepository repo,
        ILocationCatalogSeedSource seed,
        IResponseCache cache,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repo;
        _seed = seed;
        _cache = cache;
    }

    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        var payload = _seed.Load();
        if (payload is null || payload.Regions.Count == 0 || payload.Cities.Count == 0)
            return;

 // Fast path: official catalog already imported (3077) with search keys.
        var officialActive = await _repo.CountOfficialSearchableCitiesAsync(cancellationToken);
        var activeRegions = await _repo.CountActiveRegionsAsync(cancellationToken);
        var expectedActiveCities = payload.Cities.Count(c => c.IsActive);
        if (activeRegions >= payload.Regions.Count && officialActive >= expectedActiveCities)
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
                    Id = SeedGuid(0xB1, row.Id),
                    OfficialId = row.Id,
                    CreatedAtUtc = now,
                };
                await _repo.AddRegionAsync(entity, cancellationToken);
            }

            entity.Code = row.Code.Trim();
            entity.AdminAreaId = row.AdminAreaId;
            entity.NameAr = row.NameAr.Trim();
            entity.CapitalAr = row.CapitalAr.Trim();
            entity.IsActive = row.IsActive;
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

            var nameAr = row.NameAr.Trim();
            var nameSearch = string.IsNullOrWhiteSpace(row.NameSearch)
                ? LocationNameNormalizer.Normalize(nameAr)
                : LocationNameNormalizer.Normalize(row.NameSearch);
            var id = SeedGuid(0xB2, row.Id);

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

            entity.RegionId = regionId;
            entity.NameAr = nameAr;
            entity.NameEn = string.IsNullOrWhiteSpace(row.NameEn) ? null : row.NameEn.Trim();
            entity.NameSearch = nameSearch;
            entity.IsGovernorate = row.IsGovernorate;
            entity.IsCapital = row.IsCapital;
            entity.IsActive = row.IsActive;
            entity.DuplicateOfOfficialId = row.DuplicateOf;
            if (entity.Status != LocationCatalogStatuses.Pending)
                entity.Status = LocationCatalogStatuses.Approved;
        }

 // Old v1 seeded cities that are not in the official catalog: deactivate (keep pending user rows).
        foreach (var orphan in existingCities)
        {
            if (orphan.Status == LocationCatalogStatuses.Pending) continue;
            if (orphan.OfficialId is int oid)
            {
                if (!touchedOfficialCities.Contains(oid))
                    orphan.IsActive = false;
                continue;
            }

 // Legacy seeded row without OfficialId yet — deactivate if its Guid is not in the new set.
            var stillOfficial = payload.Cities.Any(c => SeedGuid(0xB2, c.Id) == orphan.Id);
            if (!stillOfficial)
                orphan.IsActive = false;
        }

 // Backfill OfficialId on regions that were seeded before the column existed (matched by SeedGuid).
        foreach (var row in payload.Regions)
        {
            var expectedId = SeedGuid(0xB1, row.Id);
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

    public async Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await _cache.GetOrCreateAsync(
            CacheKeys.RegionsCatalog,
            CacheDurations.RegionsCatalog,
            _repo.ListSelectableRegionsAsync,
            cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableCityDto>> ListAllSelectableCitiesAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await _cache.GetOrCreateAsync(
            CacheKeys.CitiesCatalog,
            CacheDurations.RegionsCatalog,
            _repo.ListSelectableCitiesAsync,
            cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableCityDto>> SearchCitiesAsync(
        Guid regionId,
        string? query,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);

        var region = await _repo.FindActiveRegionSummaryAsync(regionId, cancellationToken);
        if (region is null) return [];

        var q = LocationNameNormalizer.Normalize(query);
        var rows = await _repo.SearchCitiesAsync(regionId, q, query, cancellationToken);

        return rows
            .Select(c =>
            {
                var dto = ToCityDto(c);
                dto.RegionNameAr = region.NameAr;
                return dto;
            })
            .ToList();
    }

    public async Task<IReadOnlyList<SelectableDistrictDto>> SearchDistrictsAsync(
        Guid cityId,
        string? query,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var q = LocationNameNormalizer.Normalize(query);
        return await _repo.SearchDistrictsAsync(cityId, q, query, cancellationToken);
    }

    public async Task<SuggestLocationResultDto> SuggestAsync(
        SuggestLocationRequest request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var raw = (request.NameAr ?? "").Trim();
        if (!LocationNameNormalizer.LooksLikeArabicName(raw))
            throw new InvalidOperationException("الاسم يجب أن يكون بالعربية (٢–١٥٠ حرفاً).");

        var kind = (request.Kind ?? "city").Trim().ToLowerInvariant();
        var search = LocationNameNormalizer.Normalize(raw);

        if (kind == "district")
        {
            if (request.CityId is null || request.CityId == Guid.Empty)
                throw new InvalidOperationException("اختيار المدينة مطلوب قبل إضافة حي.");

            var cityOk = await _repo.IsCitySelectableAsync(request.CityId.Value, cancellationToken);
            if (!cityOk) throw new InvalidOperationException("المدينة غير موجودة.");

            var existing = await _repo.ListSelectableDistrictsAsync(
                request.CityId.Value, cancellationToken);

            var exactPending = existing.FirstOrDefault(d =>
                d.Status == LocationCatalogStatuses.Pending && d.NameSearch == search);
            if (exactPending is not null)
            {
                exactPending.UsageCount += 1;
                await _repo.SaveChangesAsync(cancellationToken);
                return new SuggestLocationResultDto
                {
                    Created = false,
                    District = new SelectableDistrictDto
                    {
                        Id = exactPending.Id,
                        CityId = exactPending.CityId,
                        NameAr = exactPending.NameAr,
                        Status = exactPending.Status,
                    },
                };
            }

            var similar = existing
                .Where(d =>
                    d.NameSearch == search
                    || LocationNameNormalizer.EditDistance(d.NameSearch, search) <= 2)
                .Select(d => new LocationSimilarityDto
                {
                    Id = d.Id,
                    NameAr = d.NameAr,
                    Status = d.Status,
                    IsApproved = d.Status == LocationCatalogStatuses.Approved,
                })
                .Take(8)
                .ToList();

            if (similar.Count > 0 && !request.ForceCreate)
            {
                return new SuggestLocationResultDto
                {
                    RequiresConfirmation = true,
                    Similar = similar,
                };
            }

            var row = new District
            {
                Id = Guid.NewGuid(),
                CityId = request.CityId.Value,
                NameAr = raw,
                NameSearch = search,
                Status = LocationCatalogStatuses.Pending,
                RawInput = raw,
                CreatedByUserId = userId,
                CreatedAtUtc = _time.UtcNow(),
                UsageCount = 1,
                IsActive = true,
            };
            await _repo.AddDistrictAsync(row, cancellationToken);
            await _repo.SaveChangesAsync(cancellationToken);
            await InvalidateCatalogCache(cancellationToken);
            return new SuggestLocationResultDto
            {
                Created = true,
                District = new SelectableDistrictDto
                {
                    Id = row.Id,
                    CityId = row.CityId,
                    NameAr = row.NameAr,
                    Status = row.Status,
                },
            };
        }

        if (request.RegionId is null || request.RegionId == Guid.Empty)
            throw new InvalidOperationException("اختيار المنطقة مطلوب قبل إضافة مدينة.");

        var region = await _repo.GetActiveRegionAsync(request.RegionId.Value, cancellationToken)
            ?? throw new InvalidOperationException("المنطقة غير موجودة.");

        var cities = await _repo.ListSelectableCitiesAsync(
            request.RegionId.Value, cancellationToken);

        var exactPendingCity = cities.FirstOrDefault(c =>
            c.Status == LocationCatalogStatuses.Pending && c.NameSearch == search);
        if (exactPendingCity is not null)
        {
            exactPendingCity.UsageCount += 1;
            await _repo.SaveChangesAsync(cancellationToken);
            var dto = ToCityDto(exactPendingCity);
            dto.RegionNameAr = region.NameAr;
            return new SuggestLocationResultDto { Created = false, City = dto };
        }

        var similarCities = cities
            .Where(c =>
                c.NameSearch == search
                || LocationNameNormalizer.EditDistance(c.NameSearch, search) <= 2)
            .Select(c => new LocationSimilarityDto
            {
                Id = c.Id,
                NameAr = c.NameAr,
                Status = c.Status,
                IsApproved = c.Status == LocationCatalogStatuses.Approved,
            })
            .Take(8)
            .ToList();

        if (similarCities.Count > 0 && !request.ForceCreate)
        {
            return new SuggestLocationResultDto
            {
                RequiresConfirmation = true,
                Similar = similarCities,
            };
        }

        var city = new City
        {
            Id = Guid.NewGuid(),
            OfficialId = null,
            RegionId = request.RegionId.Value,
            NameAr = raw,
            NameSearch = search,
            Status = LocationCatalogStatuses.Pending,
            RawInput = raw,
            CreatedByUserId = userId,
            CreatedAtUtc = _time.UtcNow(),
            UsageCount = 1,
            IsActive = true,
            IsGovernorate = false,
            IsCapital = false,
        };
        await _repo.AddCityAsync(city, cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
        await InvalidateCatalogCache(cancellationToken);
        var created = ToCityDto(city);
        created.RegionNameAr = region.NameAr;
        return new SuggestLocationResultDto { Created = true, City = created };
    }

    public async Task<IReadOnlyList<PendingLocationDto>> ListPendingAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var cities = await _repo.ListPendingCitiesAsync(cancellationToken);
        var districts = await _repo.ListPendingDistrictsAsync(cancellationToken);

        return cities.Concat(districts)
            .OrderByDescending(x => x.UsageCount)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToList();
    }

    public async Task ReviewCityAsync(
        Guid cityId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default)
    {
        var city = await _repo.FindCityAsync(cityId, cancellationToken)
            ?? throw new InvalidOperationException("المدينة غير موجودة.");
        if (city.Status != LocationCatalogStatuses.Pending)
            throw new InvalidOperationException("السجل ليس بانتظار المراجعة.");

        var action = (request.Action ?? "").Trim().ToLowerInvariant();
        var now = _time.UtcNow();
        if (action == "approve" || action == "rename")
        {
            if (!string.IsNullOrWhiteSpace(request.NameAr))
            {
                var name = request.NameAr.Trim();
                if (!LocationNameNormalizer.LooksLikeArabicName(name))
                    throw new InvalidOperationException("الاسم يجب أن يكون بالعربية.");
                city.NameAr = name;
                city.NameSearch = LocationNameNormalizer.Normalize(name);
            }
            city.Status = LocationCatalogStatuses.Approved;
            city.ReviewedAtUtc = now;
            city.ReviewedByUserId = reviewerUserId;
        }
        else if (action == "merge")
        {
            if (request.MergeIntoId is null || request.MergeIntoId == Guid.Empty)
                throw new InvalidOperationException("معرّف الدمج مطلوب.");
            if (request.MergeIntoId == city.Id)
                throw new InvalidOperationException("لا يمكن الدمج على نفس السجل.");

            var target = await _repo.FindActiveCityAsync(
                request.MergeIntoId.Value, cancellationToken)
                ?? throw new InvalidOperationException("سجل الدمج غير موجود.");

            target.UsageCount += city.UsageCount;
            city.Status = LocationCatalogStatuses.Merged;
            city.MergedIntoCityId = target.Id;
            city.IsActive = false;
            city.ReviewedAtUtc = now;
            city.ReviewedByUserId = reviewerUserId;
        }
        else
        {
            throw new InvalidOperationException("إجراء غير معروف.");
        }

        await _repo.SaveChangesAsync(cancellationToken);
        await InvalidateCatalogCache(cancellationToken);
    }

    public async Task ReviewDistrictAsync(
        Guid districtId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default)
    {
        var district = await _repo.FindDistrictAsync(districtId, cancellationToken)
            ?? throw new InvalidOperationException("الحي غير موجود.");
        if (district.Status != LocationCatalogStatuses.Pending)
            throw new InvalidOperationException("السجل ليس بانتظار المراجعة.");

        var action = (request.Action ?? "").Trim().ToLowerInvariant();
        var now = _time.UtcNow();
        if (action is "approve" or "rename")
        {
            if (!string.IsNullOrWhiteSpace(request.NameAr))
            {
                var name = request.NameAr.Trim();
                if (!LocationNameNormalizer.LooksLikeArabicName(name))
                    throw new InvalidOperationException("الاسم يجب أن يكون بالعربية.");
                district.NameAr = name;
                district.NameSearch = LocationNameNormalizer.Normalize(name);
            }
            district.Status = LocationCatalogStatuses.Approved;
            district.ReviewedAtUtc = now;
            district.ReviewedByUserId = reviewerUserId;
        }
        else if (action == "merge")
        {
            if (request.MergeIntoId is null || request.MergeIntoId == Guid.Empty)
                throw new InvalidOperationException("معرّف الدمج مطلوب.");
            var target = await _repo.FindActiveDistrictAsync(
                request.MergeIntoId.Value, cancellationToken)
                ?? throw new InvalidOperationException("سجل الدمج غير موجود.");
            target.UsageCount += district.UsageCount;
            district.Status = LocationCatalogStatuses.Merged;
            district.MergedIntoDistrictId = target.Id;
            district.IsActive = false;
            district.ReviewedAtUtc = now;
            district.ReviewedByUserId = reviewerUserId;
        }
        else
        {
            throw new InvalidOperationException("إجراء غير معروف.");
        }

        await _repo.SaveChangesAsync(cancellationToken);
    }

    private async Task InvalidateCatalogCache(CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync(CacheKeys.RegionsCatalog, cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CitiesCatalog, cancellationToken);
    }

    private static SelectableCityDto ToCityDto(City c) => new()
    {
        Id = c.Id,
        OfficialId = c.OfficialId,
        RegionId = c.RegionId,
        NameAr = c.NameAr,
        NameEn = c.NameEn,
        IsCapital = c.IsCapital,
        IsGovernorate = c.IsGovernorate,
        Status = c.Status,
        RegionNameAr = c.Region?.NameAr ?? "",
    };

    private static Guid SeedGuid(byte kind, int id)
    {
        var bytes = new byte[16];
        bytes[0] = kind;
        bytes[7] = 0x40;
        bytes[8] = 0x80;
        var idBytes = BitConverter.GetBytes(id);
        if (BitConverter.IsLittleEndian) Array.Reverse(idBytes);
        Buffer.BlockCopy(idBytes, 0, bytes, 12, 4);
        return new Guid(bytes);
    }
}
