namespace RealEstateEval.Platform.Application.Contracts;

/// <summary>admin-managed factor definition (تعريف + ما لا يشمله).</summary>
public class DifferenceFactorDefinitionDto
{
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    public string DefinitionAr { get; init; } = "";
 /// <summary>«ما لا يشمله» — the anti-double-counting limits.</summary>
    public string ExcludesAr { get; init; } = "";
    public int SortOrder { get; init; }
    public bool IsActive { get; init; } = true;
}

public class DifferenceFactorCatalogDto
{
    public IReadOnlyList<DifferenceFactorDefinitionDto> Factors { get; init; } = [];
 /// <summary>سجل نسخ — bumped on every admin save; audit rows carry the diff.</summary>
    public int Version { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
}

public class SaveDifferenceFactorCatalogRequest
{
    public IReadOnlyList<DifferenceFactorDefinitionDto>? Factors { get; init; }
}
