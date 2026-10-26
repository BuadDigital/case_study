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

    /// <summary>
    /// Round-2 decision B: a rationale the methodology requires (factor, manual weight, alert
    /// override, liquidation discount, cap rate, cost discount / obsolescence) is at least this
    /// many characters after trimming.
    /// </summary>
    public const int RequiredMinLength = 10;

    /// <summary>The required rationale is long enough (≥ <see cref="RequiredMinLength"/> trimmed).</summary>
    public static bool MeetsRequiredMinimum(string? rationale) =>
        (rationale?.Trim().Length ?? 0) >= RequiredMinLength;

    /// <summary>
    /// Written but shorter than <see cref="RequiredMinLength"/> — refused at save; blank stays a draft,
    /// and issuance is held by <see cref="ValuationIssuanceGateRules.AdjustmentRationales"/> (factors,
    /// manual weights) or the methodology alert that asks for it (6, 10, 12, the overrides) until it
    /// meets <see cref="MeetsRequiredMinimum"/>.
    /// </summary>
    public static bool IsBelowRequiredMinimum(string? rationale) =>
        !IsBlank(rationale) && !MeetsRequiredMinimum(rationale);

    /// <summary>«مبرر الوزن اليدوي يجب ألا يقل عن 10 أحرف».</summary>
    public static string RequiredMinimumMessageAr(string labelAr) =>
        $"{labelAr} يجب ألا يقل عن {RequiredMinLength} أحرف";
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
