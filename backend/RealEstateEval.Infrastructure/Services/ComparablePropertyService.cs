using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class ComparablePropertyService(
    ValuationDbContext db,
    CaseStudyDbContext caseStudy) : IComparablePropertyService
{
    private const int MaxTake = 200;

    public async Task<IReadOnlyList<ComparablePropertyDto>> ListAsync(
        ComparablePropertyListQuery query,
        CancellationToken cancellationToken = default)
    {
        var take = query.Take is < 1 or > MaxTake ? 100 : query.Take;
        var q = db.ComparableProperties.AsNoTracking().AsQueryable();

        if (!query.IncludeInactive)
            q = q.Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(query.District))
        {
            var d = query.District.Trim();
            q = q.Where(x => x.District.Contains(d));
        }

        if (!string.IsNullOrWhiteSpace(query.City))
        {
            var c = query.City.Trim();
            q = q.Where(x => x.City != null && x.City.Contains(c));
        }

        if (!string.IsNullOrWhiteSpace(query.TransactionKind))
            q = q.Where(x => x.TransactionKind == query.TransactionKind.Trim());

        if (!string.IsNullOrWhiteSpace(query.Source))
            q = q.Where(x => x.Source == query.Source.Trim());

        if (!string.IsNullOrWhiteSpace(query.IntakeChannel))
            q = q.Where(x => x.IntakeChannel == query.IntakeChannel.Trim());

        if (!string.IsNullOrWhiteSpace(query.PropertyType))
        {
            var t = query.PropertyType.Trim();
            q = q.Where(x => x.ComparablePropertyType.Contains(t));
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            q = q.Where(x =>
                x.ReferenceCode.Contains(term)
                || x.ComparablePropertyType.Contains(term)
                || x.District.Contains(term)
                || (x.ListingNumber != null && x.ListingNumber.Contains(term))
                || (x.Description != null && x.Description.Contains(term)));
        }

        if (DateOnly.TryParse(query.FromDate, out var from))
            q = q.Where(x => x.TransactionDate >= from);

        if (DateOnly.TryParse(query.ToDate, out var to))
            q = q.Where(x => x.TransactionDate <= to);

        var rows = await q
            .OrderByDescending(x => x.TransactionDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return rows.Select(r => ToDto(r, today)).ToList();
    }

    public async Task<ComparablePropertyDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await db.ComparableProperties.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;
        var getAnomaly = await ComputeAnomalyNoteAsync(row, cancellationToken);
        return ComparablePropertyMapping.ToDto(row, DateOnly.FromDateTime(DateTime.UtcNow), getAnomaly);
    }

    public async Task<(ComparablePropertyDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertComparablePropertyRequest request,
        string enteredByUserId,
        CancellationToken cancellationToken = default)
    {
        var errors = Validate(request);
        if (errors.Count > 0) return (null, errors);

        var now = DateTime.UtcNow;
        var id = Guid.NewGuid();
        var entity = MapToEntity(new ComparableProperty { Id = id }, request);
        entity.ReferenceCode = BuildReferenceCode(id);
        entity.EnteredByUserId = string.IsNullOrWhiteSpace(enteredByUserId)
            ? null
            : enteredByUserId.Trim();
        entity.EnteredAtUtc = now;
        entity.CreatedAtUtc = now;
        entity.UpdatedAtUtc = now;

        db.ComparableProperties.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
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

        var entity = await db.ComparableProperties
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
            return (null, new Dictionary<string, string> { ["_"] = "المقارن غير موجود" });

        MapToEntity(entity, request);
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        var updateAnomaly = await ComputeAnomalyNoteAsync(entity, cancellationToken);
        return (ComparablePropertyMapping.ToDto(entity, DateOnly.FromDateTime(DateTime.UtcNow), updateAnomaly), null);
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await db.ComparableProperties
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return (false, "المقارن غير موجود");
        entity.IsActive = false;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
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
        var q = db.ComparableProperties.AsNoTracking().Where(x => x.IsActive);
        if (exclude.Count > 0)
            q = q.Where(x => !exclude.Contains(x.Id));

        if (!string.IsNullOrWhiteSpace(query.District))
        {
            var d = query.District.Trim();
            q = q.Where(x => x.District.Contains(d));
        }

        if (!string.IsNullOrWhiteSpace(query.PropertyType))
        {
            var t = query.PropertyType.Trim();
            q = q.Where(x => x.ComparablePropertyType.Contains(t));
        }

 // Pull a wider pool then rank in memory — Haversine is not trivial in SQL across providers.
        var pool = await q
            .OrderByDescending(x => x.TransactionDate)
            .Take(500)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
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

        var workspace = await caseStudy.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.PropertyId == propertyGuid)
            .OrderByDescending(w => w.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

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
        entity.TransactionKind = kind;
        entity.PriceDescription = priceDesc;
        entity.Source = request.Source.Trim().ToLowerInvariant();
        entity.ListingNumber = Normalize(request.ListingNumber);
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
                errors["priceDescription"] = "وصف السعر (حد/تفاوض) مطلوب للعروض";
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
        var peers = await db.ComparableProperties.AsNoTracking()
            .Where(c => c.IsActive && c.Id != entity.Id && c.District == entity.District)
            .OrderByDescending(c => c.TransactionDate)
            .Take(50)
            .Select(c => c.PricePerSqm)
            .ToListAsync(cancellationToken);
        return ComparablePropertyRules.PricePerSqmAnomalyNote(entity.PricePerSqm, peers);
    }

    private static string BuildReferenceCode(Guid id) =>
        $"CMP-{id.ToString("N")[..8].ToUpperInvariant()}";

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ComparablePropertyDto ToDto(ComparableProperty row, DateOnly today) =>
        ComparablePropertyMapping.ToDto(row, today);
}
