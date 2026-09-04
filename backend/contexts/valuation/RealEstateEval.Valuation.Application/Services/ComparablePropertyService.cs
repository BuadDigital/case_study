using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// Comparable-properties bank use case: filtered listing with the field-first display priority,
/// upserts with quality tagging, and proximity suggestions. Persistence goes through
/// <see cref="IComparablePropertyRepository"/>, so this file holds rules only - no EF
/// (solid-scorecard finding 1).
/// </summary>
public sealed class ComparablePropertyService(
    IComparablePropertyRepository repo,
    ICaseStudyLookup caseStudy,
    TimeProvider? time = null) : IComparablePropertyService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    private const int MaxTake = 200;
    private const int ProximityPoolSize = 500;
    private const int AnomalyPeerSample = 50;

    public async Task<IReadOnlyList<ComparablePropertyDto>> ListAsync(
        ComparablePropertyListQuery query,
        CancellationToken cancellationToken = default)
    {
        var take = query.Take is < 1 or > MaxTake ? 100 : query.Take;
        var rows = await repo.ListPageAsync(Filter(query), 0, take, cancellationToken);
        return await ToDtosAsync(rows, cancellationToken);
    }

 /// <summary>
 /// One page of the same filtered, sorted set. The comparison-method §2 field-first display
 /// priority is part of the SQL ordering (see <c>ComparableBankFilter.ForPropertyId</c>), so no
 /// row is dropped after materialisation and TotalCount always agrees with the page.
 /// See docs/architecture/pagination-contract.md §4.
 /// </summary>
    public async Task<PagedResultDto<ComparablePropertyDto>> ListPagedAsync(
        ComparablePropertyListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var filter = Filter(query);
        var total = await repo.CountAsync(filter, cancellationToken);
        var rows = await repo.ListPageAsync(filter, skip, take, cancellationToken);

        return new PagedResultDto<ComparablePropertyDto>
        {
            Items = await ToDtosAsync(rows, cancellationToken),
            TotalCount = total,
            Page = page,
            PageSize = take,
        };
    }

    private static ComparableBankFilter Filter(ComparablePropertyListQuery query) =>
        new(
            query.IncludeInactive,
            query.District,
            query.City,
            query.TransactionKind,
            query.Source,
            query.IntakeChannel,
            query.PropertyType,
            ComparablePropertyListQueryRules.NormalizeSearch(query.Q),
            DateOnly.TryParse(query.FromDate, out var from) ? from : null,
            DateOnly.TryParse(query.ToDate, out var to) ? to : null,
            ComparablePropertyListQueryRules.ResolveForPropertyId(query.ForPropertyId),
            ComparablePropertyListQueryRules.ResolveSort(query.Sort),
            ComparablePropertyListQueryRules.ResolveDescending(query.Dir));

    private async Task<IReadOnlyList<ComparablePropertyDto>> ToDtosAsync(
        IReadOnlyList<ComparableProperty> rows,
        CancellationToken cancellationToken)
    {
 // Q-3/2: system suggests suspicion (two records at same location) and neither blocks nor merges automatically.
        var suspectCoords = await DuplicateSuspectCoordsAsync(cancellationToken);

        var today = DateOnly.FromDateTime(_time.UtcNow());
        return rows
            .Select(r => ComparablePropertyMapping.ToDto(
                r, today, duplicateSuspect: suspectCoords.Contains((r.Latitude, r.Longitude))))
            .ToList();
    }

 /// <summary>Coordinate pairs shared by more than one active record — "location is the discriminator".</summary>
    private async Task<HashSet<(decimal, decimal)>> DuplicateSuspectCoordsAsync(
        CancellationToken cancellationToken)
    {
        var pairs = await repo.ListDuplicateCoordinatesAsync(cancellationToken);
        return pairs.Select(p => (p.Latitude, p.Longitude)).ToHashSet();
    }

    public async Task<ComparablePropertyDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await repo.GetAsync(id, cancellationToken);
        if (row is null) return null;
        var getAnomaly = await ComputeAnomalyNoteAsync(row, cancellationToken);
        return ComparablePropertyMapping.ToDto(row, DateOnly.FromDateTime(_time.UtcNow()), getAnomaly);
    }

    public async Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertComparablePropertyRequest request,
        string enteredByUserId,
        CancellationToken cancellationToken = default)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var now = _time.UtcNow();
        var id = Guid.NewGuid();
        var entity = MapToEntity(new ComparableProperty { Id = id }, request);
        entity.ReferenceCode = BuildReferenceCode(id);
        entity.EnteredByUserId = string.IsNullOrWhiteSpace(enteredByUserId)
            ? null
            : enteredByUserId.Trim();
        entity.EnteredAtUtc = now;
        entity.CreatedAtUtc = now;
        entity.UpdatedAtUtc = now;

        await repo.AddAsync(entity, cancellationToken);
        if (entity.SourcePropertyId is Guid sourcePropertyId && sourcePropertyId != Guid.Empty)
        {
            await repo.AddLinkAsync(
                new PropertyComparableLink
                {
                    Id = Guid.NewGuid(),
                    PropertyId = sourcePropertyId,
                    ComparablePropertyId = entity.Id,
                    Description = entity.Description,
                    LinkedByUserId = entity.EnteredByUserId,
                    LinkedAtUtc = now,
                },
                cancellationToken);
        }
        await repo.SaveChangesAsync(cancellationToken);
        var anomaly = await ComputeAnomalyNoteAsync(entity, cancellationToken);
        return (ComparablePropertyMapping.ToDto(entity, DateOnly.FromDateTime(now), anomaly), null);
    }

    public async Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> UpdateAsync(
        Guid id,
        UpsertComparablePropertyRequest request,
        CancellationToken cancellationToken = default)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "المقارن غير موجود" });

        MapToEntity(entity, request);
        entity.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);
        var updateAnomaly = await ComputeAnomalyNoteAsync(entity, cancellationToken);
        return (ComparablePropertyMapping.ToDto(entity, DateOnly.FromDateTime(_time.UtcNow()), updateAnomaly), null);
    }

    public async Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> SetQualityTagsAsync(
        Guid id,
        SaveComparableQualityTagsRequest request,
        string taggedByUserId,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "المقارن غير موجود" });

        // B2/Q-3: tagging rules on the aggregate — service coordinates only.
        var tagError = entity.ApplyQualityTags(
            request.ReliabilityTag,
            request.IsDuplicateTagged,
            request.TagRationale,
            taggedByUserId,
            _time.UtcNow());
        if (tagError is not null)
            return (null, new Dictionary<string, string> { [tagError.Value.Field] = tagError.Value.MessageAr });

        await repo.SaveChangesAsync(cancellationToken);
        var anomaly = await ComputeAnomalyNoteAsync(entity, cancellationToken);
        return (
            ComparablePropertyMapping.ToDto(
                entity, DateOnly.FromDateTime(_time.UtcNow()), anomaly),
            null);
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null) return (false, "المقارن غير موجود");
        entity.IsActive = false;
        entity.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> ReactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindAsync(id, cancellationToken);
        if (entity is null) return (false, "المقارن غير موجود");
        entity.IsActive = true;
        entity.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<ComparableProximitySuggestionListDto> SuggestByProximityAsync(
        ComparableProximityQuery query,
        CancellationToken cancellationToken = default)
    {
        var (lat, lon, source) = await ResolveSubjectCoordsAsync(query, cancellationToken);
        if (lat is null || lon is null
            || !ComparableProximityRules.HasUsableCoordinates(lat.Value, lon.Value))
        {
            return new ComparableProximitySuggestionListDto
            {
                SubjectCoordSource = source,
                MaxDistanceKm = query.MaxDistanceKm <= 0
                    ? ComparableProximityRules.DefaultMaxDistanceKm
                    : query.MaxDistanceKm,
            };
        }

        var exclude = ParseExcludeIds(query.ExcludeIds);
 // Q-3: anomalous/unreliable/duplicate tagged items are excluded from suggestions (remain visible in the bank, marked).
 // Pull a wider pool then rank in memory — Haversine is not trivial in SQL across providers.
        var pool = await repo.ListProximityPoolAsync(
            new ComparableProximityFilter(exclude, query.District, query.PropertyType),
            ProximityPoolSize,
            cancellationToken);

        var today = DateOnly.FromDateTime(_time.UtcNow());
        var ranked = ComparableProximityRules.RankByDistance(
            lat.Value,
            lon.Value,
            pool.Select(r => (r, r.Latitude, r.Longitude)),
            query.MaxDistanceKm,
            query.Take);

        return new ComparableProximitySuggestionListDto
        {
            SubjectLatitude = lat,
            SubjectLongitude = lon,
            SubjectCoordSource = source,
            MaxDistanceKm = query.MaxDistanceKm <= 0
                ? ComparableProximityRules.DefaultMaxDistanceKm
                : query.MaxDistanceKm,
            Items = ranked.Select(x => new ComparableProximitySuggestionDto
            {
                Comparable = ToDto(x.Item, today),
                DistanceKm = x.DistanceKm,
            }).ToList(),
        };
    }

    private async Task<(decimal? Lat, decimal? Lon, string Source)> ResolveSubjectCoordsAsync(
        ComparableProximityQuery query,
        CancellationToken cancellationToken)
    {
        if (query.Latitude is { } qLat
            && query.Longitude is { } qLon
            && ComparableProximityRules.HasUsableCoordinates(qLat, qLon))
        {
            return (qLat, qLon, "query");
        }

        var propertyId = query.PropertyId?.Trim() ?? "";
        if (!Guid.TryParse(propertyId, out var propertyGuid))
            return (null, null, "none");

        var context = await caseStudy.GetValuationPropertyContextAsync(
            propertyGuid,
            cancellationToken);
        var workspace = context?.LatestWorkspace;

        if (workspace?.MapLatitude is { } wLat
            && workspace.MapLongitude is { } wLon
            && ComparableProximityRules.HasUsableCoordinates(wLat, wLon))
        {
            return (wLat, wLon, "field_inspection");
        }

        return (null, null, "none");
    }

    private static HashSet<Guid> ParseExcludeIds(string? raw)
    {
        var set = new HashSet<Guid>();
        if (string.IsNullOrWhiteSpace(raw)) return set;
        foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Guid.TryParse(part, out var id))
                set.Add(id);
        }

        return set;
    }

    private static ComparableProperty MapToEntity(
        ComparableProperty entity,
        UpsertComparablePropertyRequest request)
    {
        var kind = request.TransactionKind.Trim().ToLowerInvariant();
        var priceDesc = kind == ComparableTransactionKinds.Offer
            ? (request.PriceDescription ?? "").Trim().ToLowerInvariant()
            : "";

        entity.ComparablePropertyType = request.ComparablePropertyType.Trim();
        entity.Usage = (request.Usage ?? "").Trim();
        entity.TransactionKind = kind;
        entity.PriceDescription = priceDesc;
        entity.Source = request.Source.Trim().ToLowerInvariant();
        entity.ListingNumber = Normalize(request.ListingNumber);
 // Q-3/3: deal reference for closed deals — counterpart to listing number for offers.
        entity.TransactionReference = kind == ComparableTransactionKinds.Executed
            ? Normalize(request.TransactionReference)
            : null;
        entity.AdvertiserPhone = Normalize(request.AdvertiserPhone);
        entity.ListingImageFileName = Normalize(request.ListingImageFileName);
        entity.Latitude = request.Latitude;
        entity.Longitude = request.Longitude;
        entity.AreaSqm = request.AreaSqm;
        entity.TransactionDate = DateOnly.Parse(request.TransactionDate.Trim());
        entity.Price = request.Price;
        entity.PricePerSqm = ComparablePropertyRules.ComputePricePerSqm(
            request.Price,
            request.AreaSqm);
        entity.City = Normalize(request.City);
        entity.District = request.District.Trim();
        entity.PlanNumber = Normalize(request.PlanNumber);
        entity.PlotNumber = Normalize(request.PlotNumber);
        entity.Description = Normalize(request.Description);
        entity.IntakeChannel = request.IntakeChannel.Trim().ToLowerInvariant();
        entity.SourceWorkOrderNumber = Normalize(request.SourceWorkOrderNumber);
        entity.SourcePropertyId = request.SourcePropertyId;
        entity.IsActive = request.IsActive;
        return entity;
    }

    private static Dictionary<string, string> Validate(UpsertComparablePropertyRequest request)
    {
        var errors = new Dictionary<string, string>();

        if (string.IsNullOrWhiteSpace(request.ComparablePropertyType))
            errors["comparablePropertyType"] = "نوع العقار المقارن مطلوب";

        var kind = (request.TransactionKind ?? "").Trim().ToLowerInvariant();
        if (!ComparableTransactionKinds.IsKnown(kind))
            errors["transactionKind"] = "نوع العملية يجب أن يكون عرض أو تنفيذ";

        if (kind == ComparableTransactionKinds.Offer)
        {
            var pd = (request.PriceDescription ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(pd) || !ComparablePriceDescriptions.IsKnown(pd))
                errors["priceDescription"] = "وصف السعر (حد/سوم) مطلوب للعروض";
        }

        if (!ComparableSources.IsKnown((request.Source ?? "").Trim().ToLowerInvariant()))
            errors["source"] = "مصدر غير معروف";

        if (!ComparableIntakeChannels.IsKnown((request.IntakeChannel ?? "").Trim().ToLowerInvariant()))
            errors["intakeChannel"] = "رافد الإدخال غير معروف";

        if (string.IsNullOrWhiteSpace(request.District))
            errors["district"] = "الحي مطلوب";

        if (!DateOnly.TryParse(request.TransactionDate?.Trim(), out _))
            errors["transactionDate"] = "تاريخ العملية إلزامي وبصيغة صحيحة";

        if (request.AreaSqm <= 0m)
            errors["areaSqm"] = "المساحة يجب أن تكون أكبر من صفر";

        if (request.Price < 0m)
            errors["price"] = "السعر غير صالح";

        if (request.Latitude is < -90m or > 90m)
            errors["latitude"] = "خط العرض غير صالح";

        if (request.Longitude is < -180m or > 180m)
            errors["longitude"] = "خط الطول غير صالح";

 // Coords required for map/proximity later — reject exact 0,0 as empty placeholder.
        if (request.Latitude == 0m && request.Longitude == 0m)
            errors["latitude"] = "الإحداثيات إلزامية";

        return errors;
    }

 /// <summary>advisory anomaly note vs the district's active peers.</summary>
    private async Task<string?> ComputeAnomalyNoteAsync(
        ComparableProperty entity,
        CancellationToken cancellationToken)
    {
        var peers = await repo.ListDistrictPeerPricesAsync(
            entity.Id, entity.District, AnomalyPeerSample, cancellationToken);
        return ComparablePropertyRules.PricePerSqmAnomalyNote(entity.PricePerSqm, peers);
    }

    private static string BuildReferenceCode(Guid id) =>
        $"CMP-{id.ToString("N")[..8].ToUpperInvariant()}";

    private static string? Normalize(string? value) => Texts.NullIfBlank(value);

    private static ComparablePropertyDto ToDto(ComparableProperty row, DateOnly today) =>
        ComparablePropertyMapping.ToDto(row, today);
}
