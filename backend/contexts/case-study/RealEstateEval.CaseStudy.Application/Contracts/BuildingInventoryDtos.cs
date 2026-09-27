using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.CaseStudy.Application.Contracts;

public class BuildingInventoryLineDto
{
    public Guid? Id { get; set; }
    public int SortOrder { get; set; }
 /// <summary>floor | fence | annex | basement | other</summary>
    public string StructureKind { get; set; } = "floor";
    public string Label { get; set; } = "";
    public string? AreaSqm { get; set; }
    public string? Notes { get; set; }

 /// <summary>Direct-cost catalog key (ground_floor, fence…) — null on legacy rows.</summary>
    public string? ItemKey { get; set; }
 /// <summary>sqm | lm | count | lump</summary>
    public string? Unit { get; set; }
    public decimal? BuildRatioPct { get; set; }
    public int? RepeatedFloorCount { get; set; }

 /// <summary>Read-only: who wrote / last edited this line. Ignored on save.</summary>
    public PartyFieldProvenanceEntryDto? Provenance { get; set; }
}

public class BuildingInventoryDto
{
    public Guid PropertyId { get; set; }
 /// <summary>empty | yes | no</summary>
    public string HasStructuresToValue { get; set; } = "";
 /// <summary>«مكونات العقار» as the specialist wrote it for the report.</summary>
    public string ComponentsText { get; set; } = "";
    public List<BuildingInventoryLineDto> Lines { get; set; } = [];
}

public class SaveBuildingInventoryRequest
{
 /// <summary>empty | yes | no</summary>
    /// <summary>Ignored — derived from whether any line is listed (kept for older clients).</summary>
    public string? HasStructuresToValue { get; set; }

 /// <summary>«مكونات العقار» for the report; null keeps the saved text.</summary>
    public string? ComponentsText { get; set; }

    public List<BuildingInventoryLineDto> Lines { get; set; } = [];
}
