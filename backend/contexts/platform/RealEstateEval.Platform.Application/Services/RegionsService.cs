using RealEstateEval.Application.Contracts;
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
/// (solid-scorecard finding 1). Seeding lives in <c>RegionsService.Seeding.cs</c>, the
/// reviewer actions in <c>RegionsService.Review.cs</c>, and the pure decisions in
/// <see cref="LocationCatalogRules"/>.
/// </summary>
public sealed partial class RegionsService : IRegionsService
{
    private readonly ILocationCatalogRepository _repo;
    private readonly ILocationCatalogSeedSource _seed;
    private readonly IResponseCache _cache;
 /// <summary>Absent in hosts that only read the catalog — suggestion outcomes stay silent there.</summary>
    private readonly INotificationService? _notifications;
    private readonly TimeProvider _time;

    public RegionsService(
        ILocationCatalogRepository repo,
        ILocationCatalogSeedSource seed,
        IResponseCache cache,
        TimeProvider? time = null,
        INotificationService? notifications = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repo;
        _seed = seed;
        _cache = cache;
        _notifications = notifications;
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
            .Select(c => LocationCatalogRules.ToCityDto(c, region.NameAr))
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

        var kind = LocationCatalogRules.NormalizeKind(request.Kind);
        var search = LocationNameNormalizer.Normalize(raw);

        if (kind == LocationCatalogRules.KindDistrict)
            return await SuggestDistrictAsync(request, raw, search, userId, cancellationToken);

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
            var dto = LocationCatalogRules.ToCityDto(exactPendingCity, region.NameAr);
            return new SuggestLocationResultDto { Created = false, City = dto };
        }

        var similarCities = LocationCatalogRules.SimilarCities(cities, search);

        if (LocationCatalogRules.RequiresConfirmation(similarCities, request.ForceCreate))
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
        var created = LocationCatalogRules.ToCityDto(city, region.NameAr);
        return new SuggestLocationResultDto { Created = true, City = created };
    }

    private async Task<SuggestLocationResultDto> SuggestDistrictAsync(
        SuggestLocationRequest request,
        string raw,
        string search,
        string userId,
        CancellationToken cancellationToken)
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
                District = LocationCatalogRules.ToDistrictDto(exactPending),
            };
        }

        var similar = LocationCatalogRules.SimilarDistricts(existing, search);

        if (LocationCatalogRules.RequiresConfirmation(similar, request.ForceCreate))
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
            District = LocationCatalogRules.ToDistrictDto(row),
        };
    }

    public async Task<IReadOnlyList<PendingLocationDto>> ListPendingAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var cities = await _repo.ListPendingCitiesAsync(cancellationToken);
        var districts = await _repo.ListPendingDistrictsAsync(cancellationToken);

        return LocationCatalogRules.OrderPending(cities.Concat(districts));
    }

    private async Task InvalidateCatalogCache(CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync(CacheKeys.RegionsCatalog, cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CitiesCatalog, cancellationToken);
    }
}
