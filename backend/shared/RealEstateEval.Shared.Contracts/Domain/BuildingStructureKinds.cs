namespace RealEstateEval.Domain;

/// <summary>
/// Structure-kind wire values for the building inventory, shared by the case-study
/// inventory entity and the valuation cost approach (A10 cleanup: moved to the
/// contracts leaf so neither context references the other).
/// </summary>
public static class BuildingStructureKinds
{
    public const string Floor = "floor";
    public const string Fence = "fence";
    public const string Annex = "annex";
    public const string Basement = "basement";
    public const string Other = "other";

    public static readonly string[] All =
        [Floor, Fence, Annex, Basement, Other];

    public static bool IsKnown(string? value) =>
        All.Contains(value?.Trim() ?? "", StringComparer.Ordinal);
}
