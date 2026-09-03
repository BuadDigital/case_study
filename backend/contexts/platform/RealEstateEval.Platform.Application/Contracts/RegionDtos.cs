using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Contracts;

public sealed class SelectableRegionDto
{
    public Guid Id { get; set; }
    public int OfficialId { get; set; }
    public string Code { get; set; } = "";
    public string NameAr { get; set; } = "";
    public string CapitalAr { get; set; } = "";
}

public sealed class SelectableCityDto
{
    public Guid Id { get; set; }
    public int? OfficialId { get; set; }
    public Guid RegionId { get; set; }
    public string NameAr { get; set; } = "";
    public string? NameEn { get; set; }
    public bool IsCapital { get; set; }
    public bool IsGovernorate { get; set; }
    public string Status { get; set; } = LocationCatalogStatuses.Approved;
 /// <summary>Region name — useful when city is chosen first.</summary>
    public string RegionNameAr { get; set; } = "";
}

public sealed class SelectableDistrictDto
{
    public Guid Id { get; set; }
    public Guid CityId { get; set; }
    public string NameAr { get; set; } = "";
    public string Status { get; set; } = LocationCatalogStatuses.Pending;
}

public sealed class SuggestLocationRequest
{
 /// <summary>city | district</summary>
    public string Kind { get; set; } = "city";
    public Guid? RegionId { get; set; }
    public Guid? CityId { get; set; }
    public string NameAr { get; set; } = "";
 /// <summary>When true, skip similarity gate and create pending even if similar names exist.</summary>
    public bool ForceCreate { get; set; }
}

public sealed class LocationSimilarityDto
{
    public Guid Id { get; set; }
    public string NameAr { get; set; } = "";
    public string Status { get; set; } = "";
    public bool IsApproved { get; set; }
}

public sealed class SuggestLocationResultDto
{
    public bool Created { get; set; }
    public bool RequiresConfirmation { get; set; }
    public SelectableCityDto? City { get; set; }
    public SelectableDistrictDto? District { get; set; }
    public IReadOnlyList<LocationSimilarityDto> Similar { get; set; } = [];
}

public sealed class PendingLocationDto
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "city";
    public string NameAr { get; set; } = "";
    public string? RawInput { get; set; }
    public string ScopeLabel { get; set; } = "";
    public int UsageCount { get; set; }
    public string? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class ReviewLocationRequest
{
 /// <summary>approve | rename | merge</summary>
    public string Action { get; set; } = "approve";
    public string? NameAr { get; set; }
    public Guid? MergeIntoId { get; set; }
}
