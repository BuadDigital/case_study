using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Locations;

namespace RealEstateEval.Infrastructure.Services;

public sealed class RegionsService : IRegionsService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly PlatformDbContext _db;
    private readonly ApiResponseCache _cache;
    private readonly TimeProvider _time;

    public RegionsService(PlatformDbContext db, ApiResponseCache cache,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _cache = cache;
    }

    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        var payload = LoadSeedPayload();
        if (payload?.Regions is null || payload.Cities is null || payload.Regions.Count == 0)
            return;

 // Fast path: official catalog already imported (3077) with search keys.
        var officialActive = await _db.Cities.CountAsync(
            c => c.OfficialId != null && c.IsActive && c.NameSearch != "",
            cancellationToken);
        var activeRegions = await _db.Regions.CountAsync(r => r.IsActive, cancellationToken);
        var expectedActiveCities = payload.Cities.Count(c => c.IsActive);
        if (activeRegions >= payload.Regions.Count && officialActive >= expectedActiveCities)
            return;

        var now = _time.UtcNow();
        var existingRegions = await _db.Regions.ToListAsync(cancellationToken);
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
                _db.Regions.Add(entity);
            }

            entity.Code = row.Code.Trim();
            entity.AdminAreaId = row.AdminAreaId;
            entity.NameAr = row.NameAr.Trim();
            entity.CapitalAr = row.CapitalAr.Trim();
            entity.IsActive = row.IsActive;
            regionMap[row.Id] = entity.Id;
        }

        var existingCities = await _db.Cities.ToListAsync(cancellationToken);
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
                _db.Cities.Add(entity);
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

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.RegionsCatalog, cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CitiesCatalog, cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await _cache.GetOrCreateAsync(
            CacheKeys.RegionsCatalog,
            CacheDurations.RegionsCatalog,
            async ct =>
            {
                return await _db.Regions.AsNoTracking()
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
                    .ToListAsync(ct);
            },
            cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableCityDto>> ListAllSelectableCitiesAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await _cache.GetOrCreateAsync(
            CacheKeys.CitiesCatalog,
            CacheDurations.RegionsCatalog,
            async ct =>
            {
                return await _db.Cities.AsNoTracking()
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
                    .ToListAsync(ct);
            },
            cancellationToken);
    }

    public Task<IReadOnlyList<SelectableCityDto>> ListSelectableCitiesAsync(
        Guid regionId,
        CancellationToken cancellationToken = default)
        => SearchCitiesAsync(regionId, query: null, cancellationToken);

    public async Task<IReadOnlyList<SelectableCityDto>> SearchCitiesAsync(
        Guid regionId,
        string? query,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);

        var region = await _db.Regions.AsNoTracking()
            .Where(r => r.Id == regionId && r.IsActive)
            .Select(r => new { r.Id, r.NameAr })
            .FirstOrDefaultAsync(cancellationToken);
        if (region is null) return [];

        var q = LocationNameNormalizer.Normalize(query);
        var citiesQuery = _db.Cities.AsNoTracking()
            .Where(c =>
                c.RegionId == regionId
                && c.IsActive
                && c.Status != LocationCatalogStatuses.Merged);

        if (string.IsNullOrEmpty(q))
        {
            citiesQuery = citiesQuery.Where(c =>
                c.IsGovernorate || c.Status == LocationCatalogStatuses.Pending);
        }
        else
        {
            citiesQuery = citiesQuery.Where(c =>
                c.NameSearch.Contains(q) || c.NameAr.Contains(query!.Trim()));
        }

        var rows = await citiesQuery
            .OrderByDescending(c => c.Status == LocationCatalogStatuses.Approved)
            .ThenByDescending(c => c.IsGovernorate)
            .ThenByDescending(c => c.IsCapital)
            .ThenBy(c => c.NameAr)
            .Take(200)
            .ToListAsync(cancellationToken);

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
        var districts = _db.Districts.AsNoTracking()
            .Where(d =>
                d.CityId == cityId
                && d.IsActive
                && d.Status != LocationCatalogStatuses.Merged);

        if (!string.IsNullOrEmpty(q))
        {
            districts = districts.Where(d =>
                d.NameSearch.Contains(q) || d.NameAr.Contains(query!.Trim()));
        }

        return await districts
            .OrderByDescending(d => d.Status == LocationCatalogStatuses.Approved)
            .ThenBy(d => d.NameAr)
            .Take(100)
            .Select(d => new SelectableDistrictDto
            {
                Id = d.Id,
                CityId = d.CityId,
                NameAr = d.NameAr,
                Status = d.Status,
            })
            .ToListAsync(cancellationToken);
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

            var cityOk = await _db.Cities.AnyAsync(
                c => c.Id == request.CityId && c.IsActive && c.Status != LocationCatalogStatuses.Merged,
                cancellationToken);
            if (!cityOk) throw new InvalidOperationException("المدينة غير موجودة.");

            var existing = await _db.Districts
                .Where(d =>
                    d.CityId == request.CityId
                    && d.IsActive
                    && d.Status != LocationCatalogStatuses.Merged)
                .ToListAsync(cancellationToken);

            var exactPending = existing.FirstOrDefault(d =>
                d.Status == LocationCatalogStatuses.Pending && d.NameSearch == search);
            if (exactPending is not null)
            {
                exactPending.UsageCount += 1;
                await _db.SaveChangesAsync(cancellationToken);
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
            _db.Districts.Add(row);
            await _db.SaveChangesAsync(cancellationToken);
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

        var region = await _db.Regions.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.RegionId && r.IsActive, cancellationToken)
            ?? throw new InvalidOperationException("المنطقة غير موجودة.");

        var cities = await _db.Cities
            .Where(c =>
                c.RegionId == request.RegionId
                && c.IsActive
                && c.Status != LocationCatalogStatuses.Merged)
            .ToListAsync(cancellationToken);

        var exactPendingCity = cities.FirstOrDefault(c =>
            c.Status == LocationCatalogStatuses.Pending && c.NameSearch == search);
        if (exactPendingCity is not null)
        {
            exactPendingCity.UsageCount += 1;
            await _db.SaveChangesAsync(cancellationToken);
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
        _db.Cities.Add(city);
        await _db.SaveChangesAsync(cancellationToken);
        await InvalidateCatalogCache(cancellationToken);
        var created = ToCityDto(city);
        created.RegionNameAr = region.NameAr;
        return new SuggestLocationResultDto { Created = true, City = created };
    }

    public async Task<IReadOnlyList<PendingLocationDto>> ListPendingAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var cities = await _db.Cities.AsNoTracking()
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

        var districts = await _db.Districts.AsNoTracking()
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
        var city = await _db.Cities.FirstOrDefaultAsync(c => c.Id == cityId, cancellationToken)
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

            var target = await _db.Cities.FirstOrDefaultAsync(
                c => c.Id == request.MergeIntoId && c.IsActive,
                cancellationToken)
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

        await _db.SaveChangesAsync(cancellationToken);
        await InvalidateCatalogCache(cancellationToken);
    }

    public async Task ReviewDistrictAsync(
        Guid districtId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default)
    {
        var district = await _db.Districts.FirstOrDefaultAsync(d => d.Id == districtId, cancellationToken)
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
            var target = await _db.Districts.FirstOrDefaultAsync(
                d => d.Id == request.MergeIntoId && d.IsActive,
                cancellationToken)
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

        await _db.SaveChangesAsync(cancellationToken);
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

    private static SeedFile? LoadSeedPayload()
    {
        var paths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Data", "Seed", "regions_cities.json"),
            Path.Combine(AppContext.BaseDirectory, "regions_cities.json"),
            Path.GetFullPath(Path.Combine(
                AppContext.BaseDirectory,
                "..", "..", "..", "..",
                "RealEstateEval.Platform.Infrastructure", "Data", "Seed", "regions_cities.json")),
        };

        foreach (var path in paths)
        {
            if (!File.Exists(path)) continue;
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<SeedFile>(json, JsonOpts);
        }

        var asm = typeof(RegionsService).Assembly;
        var resourceName = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("regions_cities.json", StringComparison.OrdinalIgnoreCase));
        if (resourceName is null) return null;
        using var stream = asm.GetManifestResourceStream(resourceName);
        if (stream is null) return null;
        return JsonSerializer.Deserialize<SeedFile>(stream, JsonOpts);
    }

    private sealed class SeedFile
    {
        public List<SeedRegion> Regions { get; set; } = [];
        public List<SeedCity> Cities { get; set; } = [];
    }

    private sealed class SeedRegion
    {
        public int Id { get; set; }
        public string Code { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("admin_area_id")]
        public int AdminAreaId { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("name_ar")]
        public string NameAr { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("capital_ar")]
        public string CapitalAr { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("is_active")]
        public bool IsActive { get; set; } = true;
    }

    private sealed class SeedCity
    {
        public int Id { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("region_id")]
        public int RegionId { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("name_ar")]
        public string NameAr { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("name_en")]
        public string? NameEn { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("name_search")]
        public string? NameSearch { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("is_governorate")]
        public bool IsGovernorate { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("is_capital")]
        public bool IsCapital { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("is_active")]
        public bool IsActive { get; set; } = true;
        [System.Text.Json.Serialization.JsonPropertyName("duplicate_of")]
        public int? DuplicateOf { get; set; }
    }
}
