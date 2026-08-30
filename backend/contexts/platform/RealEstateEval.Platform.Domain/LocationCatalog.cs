namespace RealEstateEval.Platform.Domain;

/// <summary>Status of approval of the title in the site directory.</summary>
public static class LocationCatalogStatuses
{
    public const string Approved = "approved";
    public const string Pending = "pending";
    public const string Merged = "merged";
}

/// <summary>Administrative area — system directory (not permanently deleted; disabled via IsActive).</summary>
public class Region
{
    public Guid Id { get; set; }
 /// <summary>Administrative ID 1–13 of the Foundation Package.</summary>
    public int OfficialId { get; set; }
 /// <summary>Area code (RD, MK, …).</summary>
    public string Code { get; set; } = "";
 /// <summary>Area identifier in the official source (national address).</summary>
    public int AdminAreaId { get; set; }
    public string NameAr { get; set; } = "";
    public string CapitalAr { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }

    public List<City> Cities { get; set; } = [];
}

/// <summary>District city/village — system directory.</summary>
public class City
{
    public Guid Id { get; set; }
 /// <summary>Official identifier as in the national title — null for initial titles.</summary>
    public int? OfficialId { get; set; }
    public Guid RegionId { get; set; }
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
 /// <summary>Normalized name for the search.</summary>
    public string NameSearch { get; set; } = "";
    public bool IsGovernorate { get; set; }
    public bool IsCapital { get; set; }
 /// <summary>approved | pending | merged</summary>
    public string Status { get; set; } = LocationCatalogStatuses.Approved;
    public string? RawInput { get; set; }
    public string? CreatedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewedByUserId { get; set; }
    public Guid? MergedIntoCityId { get; set; }
    public int? DuplicateOfOfficialId { get; set; }
    public int UsageCount { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }

    public Region? Region { get; set; }
    public City? MergedIntoCity { get; set; }
    public List<District> Districts { get; set; } = [];
}

/// <summary>City neighborhood — starts empty and builds from user input.</summary>
public class District
{
    public Guid Id { get; set; }
    public Guid CityId { get; set; }
    public string NameAr { get; set; } = "";
    public string NameSearch { get; set; } = "";
 /// <summary>approved | pending | merged</summary>
    public string Status { get; set; } = LocationCatalogStatuses.Pending;
    public string? RawInput { get; set; }
    public string? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewedByUserId { get; set; }
    public Guid? MergedIntoDistrictId { get; set; }
    public int UsageCount { get; set; }
    public bool IsActive { get; set; } = true;

    public City? City { get; set; }
    public District? MergedIntoDistrict { get; set; }
}
