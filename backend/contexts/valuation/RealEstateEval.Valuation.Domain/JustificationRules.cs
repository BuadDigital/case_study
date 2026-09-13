namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Q-8-2: required rationales must be non-blank (trimmed).
/// Applies to all required rationales in the valuation package (adjustments, weights, tags, rationale alerts)
/// without touching "free text" fields (decision 19).
/// </summary>
public static class JustificationRules
{
    /// <summary>Any non-empty trimmed text is enough — no padded minimum.</summary>
    public const int MinLength = 1;

    /// <summary>Acceptable rationale: non-empty text whose trimmed length ≥ the minimum.</summary>
    public static bool IsAcceptable(string? rationale) =>
        (rationale?.Trim().Length ?? 0) >= MinLength;

    /// <summary>Completely empty (not an entry) — distinct from "too short".</summary>
    public static bool IsBlank(string? rationale) =>
        string.IsNullOrWhiteSpace(rationale);

    /// <summary>Non-empty but shorter than the minimum (only possible if MinLength &gt; 1).</summary>
    public static bool IsTooShort(string? rationale) =>
        !IsBlank(rationale) && !IsAcceptable(rationale);

    public static string TooShortMessageAr(string labelAr) =>
        $"{labelAr}: المبرر مطلوب — اكتب سبباً غير فارغ (ق-8).";
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
