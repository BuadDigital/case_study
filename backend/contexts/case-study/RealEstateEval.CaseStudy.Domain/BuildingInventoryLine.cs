namespace RealEstateEval.Domain;

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

 /// <summary>Area m² — string for flexible field entry.</summary>
    public string? AreaSqm { get; set; }

    public string? Notes { get; set; }
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
