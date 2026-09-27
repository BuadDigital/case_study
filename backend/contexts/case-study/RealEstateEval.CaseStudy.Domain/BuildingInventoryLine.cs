using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Building/structure inventory line — single source for area details and cost items (spec ).
/// Entered by the field inspector during inspection; pricing later by the appraiser.
/// </summary>
public class BuildingInventoryLine
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public int SortOrder { get; set; }

 /// <summary>floor | fence | annex | basement | other</summary>
    public string StructureKind { get; set; } = BuildingStructureKinds.Floor;

 /// <summary>Free label — e.g. ground floor, fence, annex.</summary>
    public string Label { get; set; } = "";

 /// <summary>Area m² (or count / linear metres per <see cref="Unit"/>) — string for flexible entry.</summary>
    public string? AreaSqm { get; set; }

 /// <summary>Cost item key from the appraiser's direct-cost catalog (ground_floor, fence…); null on legacy rows.</summary>
    public string? ItemKey { get; set; }

 /// <summary>sqm | lm | count | lump — null on legacy rows (treated as sqm).</summary>
    public string? Unit { get; set; }

 /// <summary>Built-up ratio % for floor-area items.</summary>
    public decimal? BuildRatioPct { get; set; }

 /// <summary>Count of repeated floors (item «الأدوار المتكررة»).</summary>
    public int? RepeatedFloorCount { get; set; }

    public string? Notes { get; set; }

 /// <summary>Who first wrote this line and who last changed it (one <c>PartyFieldProvenanceEntryDto</c> as jsonb).</summary>
    public string ProvenanceJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public WorkOrderProperty? Property { get; set; }
}

// BuildingStructureKinds moved to Shared.Contracts (A10 cleanup): the valuation cost
// approach shares the structure-kind wire values.

/// <summary>Governing question answer: are there buildings/structures to value?</summary>
public static class HasStructuresToValueValues
{
    public const string Unset = "";
    public const string Yes = "yes";
    public const string No = "no";

    public static bool IsKnown(string? value)
    {
        var n = value?.Trim() ?? "";
        return n is Unset or Yes or No;
    }
}
