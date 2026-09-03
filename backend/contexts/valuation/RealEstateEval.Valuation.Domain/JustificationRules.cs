namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Q-8-2 (decisions log v2): minimum rationale length blocks token rationales of a letter or period.
/// Applies to all required rationales in the valuation package (adjustments, weights, tags, rationale alerts)
/// without touching "free text" fields (decision 19).
/// </summary>
public static class JustificationRules
{
 /// <summary>Package suggestion adopted in Q-8: ~10 characters.</summary>
    public const int MinLength = 10;

 /// <summary>Acceptable rationale: non-empty text whose trimmed length ≥ the minimum.</summary>
    public static bool IsAcceptable(string? rationale) =>
        (rationale?.Trim().Length ?? 0) >= MinLength;

 /// <summary>Completely empty (not an entry) — distinct from "too short".</summary>
    public static bool IsBlank(string? rationale) =>
        string.IsNullOrWhiteSpace(rationale);

 /// <summary>Non-empty but shorter than the minimum — the case Q-8-2 specifically blocks.</summary>
    public static bool IsTooShort(string? rationale) =>
        !IsBlank(rationale) && !IsAcceptable(rationale);

    public static string TooShortMessageAr(string labelAr) =>
        $"{labelAr}: المبرر أقصر من الحد الأدنى ({MinLength} أحرف) — اكتب مبرراً جوهرياً (ق-8).";
}

/// <summary>
/// Q-8-1: rationale is at factor level, not line×comparable — one factor rationale covers all comparables
/// while the logic is the same, with optional per-comparable override when they differ.
/// Adjustment row holds the "override" only; empty inherits the factor rationale.
/// </summary>
public class ValuationAdjustmentFactorRationale
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
 /// <summary>market | land_within_cost — two independent tables (mirrors selection context).</summary>
    public string SelectionContext { get; set; } = ComparableSelectionContexts.Market;
 /// <summary>See <see cref="MarketAdjustmentFactorKeys"/> — or a custom factor key.</summary>
    public string FactorKey { get; set; } = "";
    public string RationaleAr { get; set; } = "";
    public DateTime UpdatedAtUtc { get; set; }
    public string? UpdatedByUserId { get; set; }
}
