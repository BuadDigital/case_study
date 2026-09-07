using System.Diagnostics.CodeAnalysis;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// Pure decisions of the regions / cities / districts catalog: deterministic seed ids and the
/// official-payload reconciliation, the suggestion duplicate gate, the reviewer approve /
/// rename / merge transitions and the DTO projections. No ports, no I/O, no clock —
/// <c>RegionsService</c> supplies entities and <c>now</c> and persists.
/// </summary>
public static class LocationCatalogRules
{
    public const byte RegionSeedKind = 0xB1;
    public const byte CitySeedKind = 0xB2;

    public const string KindCity = "city";
    public const string KindDistrict = "district";

    public const string ActionApprove = "approve";
    public const string ActionRename = "rename";
    public const string ActionMerge = "merge";

    /// <summary>At most this many look-alikes are returned by the suggestion gate.</summary>
    public const int MaxSimilar = 8;

    /// <summary>Names within this edit distance of each other are look-alikes.</summary>
    public const int SimilarEditDistance = 2;

    // ---- seeding ----

    /// <summary>
    /// Stable id for a shipped row: the kind byte, RFC-4122 version/variant bits, and the
    /// official id big-endian in the last four bytes. The same input always yields the same Guid.
    /// </summary>
    public static Guid SeedGuid(byte kind, int id)
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

    public static Guid RegionSeedGuid(int officialId) => SeedGuid(RegionSeedKind, officialId);

    public static Guid CitySeedGuid(int officialId) => SeedGuid(CitySeedKind, officialId);

    /// <summary>A payload with no regions or no cities is not worth reconciling.</summary>
    public static bool HasUsableSeed([NotNullWhen(true)] LocationCatalogSeed? payload) =>
        payload is not null && payload.Regions.Count > 0 && payload.Cities.Count > 0;

    /// <summary>
    /// Fast path: every shipped region is active and every active shipped city already carries
    /// its official id and search key, so the reconciliation can be skipped.
    /// </summary>
    public static bool CatalogAlreadyImported(
        LocationCatalogSeed payload,
        int activeRegions,
        int officialSearchableCities)
    {
        var expectedActiveCities = payload.Cities.Count(c => c.IsActive);
        return activeRegions >= payload.Regions.Count && officialSearchableCities >= expectedActiveCities;
    }

    /// <summary>The shipped search key when present, otherwise the normalised Arabic name.</summary>
    public static string CitySearchKey(LocationSeedCity row) =>
        string.IsNullOrWhiteSpace(row.NameSearch)
            ? LocationNameNormalizer.Normalize(row.NameAr.Trim())
            : LocationNameNormalizer.Normalize(row.NameSearch);

    public static void ApplySeedRegion(Region entity, LocationSeedRegion row)
    {
        entity.Code = row.Code.Trim();
        entity.AdminAreaId = row.AdminAreaId;
        entity.NameAr = row.NameAr.Trim();
        entity.CapitalAr = row.CapitalAr.Trim();
        entity.IsActive = row.IsActive;
    }

    /// <summary>Official fields win; a row a user is still reviewing keeps its pending status.</summary>
    public static void ApplySeedCity(City entity, LocationSeedCity row, Guid regionId)
    {
        entity.RegionId = regionId;
        entity.NameAr = row.NameAr.Trim();
        entity.NameEn = string.IsNullOrWhiteSpace(row.NameEn) ? null : row.NameEn.Trim();
        entity.NameSearch = CitySearchKey(row);
        entity.IsGovernorate = row.IsGovernorate;
        entity.IsCapital = row.IsCapital;
        entity.IsActive = row.IsActive;
        entity.DuplicateOfOfficialId = row.DuplicateOf;
        if (entity.Status != LocationCatalogStatuses.Pending)
            entity.Status = LocationCatalogStatuses.Approved;
    }

    /// <summary>
    /// An old seeded city that the shipped catalog no longer lists: matched by official id when
    /// it has one, otherwise by its deterministic seed Guid. Pending user rows are never stale.
    /// </summary>
    public static bool IsStaleSeededCity(
        City city,
        IReadOnlySet<int> touchedOfficialCities,
        IReadOnlySet<Guid> currentSeedIds)
    {
        if (city.Status == LocationCatalogStatuses.Pending) return false;
        if (city.OfficialId is int oid) return !touchedOfficialCities.Contains(oid);
        return !currentSeedIds.Contains(city.Id);
    }

    // ---- suggestions ----

    public static string NormalizeKind(string? kind) => (kind ?? KindCity).Trim().ToLowerInvariant();

    public static bool IsSimilarName(string nameSearch, string search) =>
        nameSearch == search
        || LocationNameNormalizer.EditDistance(nameSearch, search) <= SimilarEditDistance;

    public static List<LocationSimilarityDto> SimilarCities(IEnumerable<City> cities, string search) =>
        cities
            .Where(c => IsSimilarName(c.NameSearch, search))
            .Select(c => ToSimilarity(c.Id, c.NameAr, c.Status))
            .Take(MaxSimilar)
            .ToList();

    public static List<LocationSimilarityDto> SimilarDistricts(
        IEnumerable<District> districts,
        string search) =>
        districts
            .Where(d => IsSimilarName(d.NameSearch, search))
            .Select(d => ToSimilarity(d.Id, d.NameAr, d.Status))
            .Take(MaxSimilar)
            .ToList();

    /// <summary>Look-alikes block creation unless the caller explicitly forces it.</summary>
    public static bool RequiresConfirmation(IReadOnlyCollection<LocationSimilarityDto> similar, bool forceCreate) =>
        similar.Count > 0 && !forceCreate;

    // ---- review ----

    public static string NormalizeAction(string? action) => (action ?? "").Trim().ToLowerInvariant();

    public static bool IsApproveOrRename(string action) => action is ActionApprove or ActionRename;

    /// <summary>
    /// The reviewer's replacement name, trimmed, or <c>null</c> to keep the suggested one.
    /// Throws when the replacement is not an Arabic name.
    /// </summary>
    public static string? ResolveReviewName(string? nameAr)
    {
        if (string.IsNullOrWhiteSpace(nameAr)) return null;
        var name = nameAr.Trim();
        if (!LocationNameNormalizer.LooksLikeArabicName(name))
            throw new InvalidOperationException("الاسم يجب أن يكون بالعربية.");
        return name;
    }

    /// <summary>Merge needs a target id; throws the reviewer-facing message when it is missing.</summary>
    public static Guid RequireMergeTarget(Guid? mergeIntoId)
    {
        if (mergeIntoId is null || mergeIntoId == Guid.Empty)
            throw new InvalidOperationException("معرّف الدمج مطلوب.");
        return mergeIntoId.Value;
    }

    public static void ApproveCity(City city, string? renamedTo, DateTime now, string reviewerUserId)
    {
        if (renamedTo is not null)
        {
            city.NameAr = renamedTo;
            city.NameSearch = LocationNameNormalizer.Normalize(renamedTo);
        }
        city.Status = LocationCatalogStatuses.Approved;
        city.ReviewedAtUtc = now;
        city.ReviewedByUserId = reviewerUserId;
    }

    /// <summary>The pending row's usage moves to the target; the row itself is retired, not deleted.</summary>
    public static void MergeCity(City city, City target, DateTime now, string reviewerUserId)
    {
        target.UsageCount += city.UsageCount;
        city.Status = LocationCatalogStatuses.Merged;
        city.MergedIntoCityId = target.Id;
        city.IsActive = false;
        city.ReviewedAtUtc = now;
        city.ReviewedByUserId = reviewerUserId;
    }

    public static void ApproveDistrict(
        District district,
        string? renamedTo,
        DateTime now,
        string reviewerUserId)
    {
        if (renamedTo is not null)
        {
            district.NameAr = renamedTo;
            district.NameSearch = LocationNameNormalizer.Normalize(renamedTo);
        }
        district.Status = LocationCatalogStatuses.Approved;
        district.ReviewedAtUtc = now;
        district.ReviewedByUserId = reviewerUserId;
    }

    public static void MergeDistrict(District district, District target, DateTime now, string reviewerUserId)
    {
        target.UsageCount += district.UsageCount;
        district.Status = LocationCatalogStatuses.Merged;
        district.MergedIntoDistrictId = target.Id;
        district.IsActive = false;
        district.ReviewedAtUtc = now;
        district.ReviewedByUserId = reviewerUserId;
    }

    // ---- lists and projections ----

    /// <summary>Most-used first, then newest, so the reviewer sees what matters.</summary>
    public static List<PendingLocationDto> OrderPending(IEnumerable<PendingLocationDto> rows) =>
        rows
            .OrderByDescending(x => x.UsageCount)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToList();

    public static SelectableCityDto ToCityDto(City c) => new()
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

    /// <summary>City projection with the region name supplied by the caller (the aggregate is not loaded).</summary>
    public static SelectableCityDto ToCityDto(City c, string regionNameAr)
    {
        var dto = ToCityDto(c);
        dto.RegionNameAr = regionNameAr;
        return dto;
    }

    public static SelectableDistrictDto ToDistrictDto(District d) => new()
    {
        Id = d.Id,
        CityId = d.CityId,
        NameAr = d.NameAr,
        Status = d.Status,
    };

    public static LocationSimilarityDto ToSimilarity(Guid id, string nameAr, string status) => new()
    {
        Id = id,
        NameAr = nameAr,
        Status = status,
        IsApproved = status == LocationCatalogStatuses.Approved,
    };
}
