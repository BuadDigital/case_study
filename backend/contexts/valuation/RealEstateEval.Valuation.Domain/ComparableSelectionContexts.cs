namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// سياق جدول المقارنات — valuation-approaches-logic §5 و §7.
/// جدولان مستقلان: أسلوب السوق vs تقدير الأرض فضاءً داخل التكلفة. لا استيراد بينهما.
/// </summary>
public static class ComparableSelectionContexts
{
    public const string Market = "market";
    public const string LandWithinCost = "land_within_cost";

    public static readonly string[] All = [Market, LandWithinCost];

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Market or LandWithinCost;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == LandWithinCost
            ? LandWithinCost
            : Market;

    public static string LabelAr(string? value) =>
        Normalize(value) == LandWithinCost
            ? "تقدير قيمة الأرض فضاءً"
            : "أسلوب السوق — جدول التسويات";
}
