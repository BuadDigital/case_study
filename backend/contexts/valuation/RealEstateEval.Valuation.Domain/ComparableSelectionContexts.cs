namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Comparable-table context — valuation-approaches-logic section 5 and section 7.
/// Two tables: market approach vs vacant-land estimate within cost. For a built subject they are
/// independent (the market table compares buildings). For a subject valued as land they are one —
/// land_within_cost answers with the market table's rows, so the land has one set of comparables
/// and adjustments in both approaches (<c>ValuationComparableSelectionService.TableOfAsync</c>,
/// ruling 2026-11-12).
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
