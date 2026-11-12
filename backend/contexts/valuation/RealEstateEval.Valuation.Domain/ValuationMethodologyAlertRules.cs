// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Alerts 24 alerts (7 hard / 12 rationale / 5 acknowledgement): new m22 «تشتّت المقارنات»,
//           m23 comparable after the valuation date — hard, m24 type mismatch,
//           m25 depreciation > 90%.
//  • m3 (age beyond the extended life) becomes a rationale alert, not hard; m4 checks only functional
//         + external obsolescence over 100%.
//  • m17 fires on net or gross above 40% and names each comparable with both figures.
// Round 2 (1b19bedc)
//  • ValuationMethodologyAlertCodes.All / Retired / IsAcceptedForDisposition — a disposition for an
//          unknown code is refused.
//  • B    Rationale alerts (6, 10, 12) and overrides clear only with at least 10 characters.
//  • m23 names «نهاية فترة التقييم» when the cutoff is the end of a retrospective period.
// Grey areas (2026-11-10)
//  • m2 is HARD: included building lines with a blank actual age / economic life (or extended life ≤ 0).
//  • m11 classifies through PropertyCategoryRules.IsBuiltType (عمارة، محل، مستودع… now count).
//  • m7/m9 read the cost line's item key; the label only for a legacy row without a key.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Methodology alerts — 24 (package v2 decisions 16 + 24 + +, then ////):
/// 8 hard / 12 require text rationale / 4 require acknowledgement (m2 hard since 2026-11-10).
/// m18/m21 evaluate only once inspection-scope data is captured (inspection boundaries).
/// </summary>
public static class ValuationMethodologyAlertCodes
{
    public const string NoCostLine = "m1_no_cost_line";
    public const string ExtendedLifeZero = "m2_extended_life_zero";
    public const string EffectiveAgeExceedsLife = "m3_effective_age_exceeds_life";
    public const string ObsolescenceOver100 = "m4_obsolescence_over_100";
    public const string NegativeValues = "m5_negative_values";
    public const string LifeExtensionNoRationale = "m6_life_extension_no_rationale";
    public const string RepeatedFloorNoArea = "m7_repeated_floor_no_area";
    public const string ExtraLineNoRationale = "m8_extra_line_no_rationale";
    public const string RepeatedUnitCostMismatch = "m9_repeated_unit_cost_mismatch";
    public const string UseRestrictionNoRationale = "m10_use_restriction_no_rationale";
    public const string NonVacantLandComps = "m11_non_vacant_land_comps";
    public const string ObsolescenceNoRationale = "m12_obsolescence_no_rationale";
    public const string DeveloperProfitOutOfRange = "m13_developer_profit_out_of_range";
    public const string IndirectRatesHigh = "m14_indirect_rates_high";
    public const string NoAdoptedComparables = "m15_no_adopted_comparables";
    public const string WeightsNot100 = "m16_weights_not_100";
    public const string LargeAdjustments = "m17_large_adjustments";
 /// <summary>Limited inspection (external/desktop/uninspected units) must explain its limits.</summary>
    public const string LimitedInspection = "m18_limited_inspection";
 /// <summary>Fewer than 3 adopted comparables (hard "zero" gate remains in m15).</summary>
    public const string FewAdoptedComparables = "m19_few_adopted_comparables";
 /// <summary>"remote desktop" scope requires certified-valuer approval (hard gate).</summary>
    public const string RemoteInspectionUnapproved = "m21_remote_inspection_unapproved";
    /// <summary>Adopted adjusted unit rates too far apart (median deviation &gt; 25٪ or CV &gt; 15٪).</summary>
    public const string ComparableDispersion = "m22_comparable_dispersion";
    /// <summary>An adopted comparable dated after the official (retrospective) valuation date.</summary>
    public const string ComparableAfterValuationDate = "m23_comparable_after_valuation_date";
    /// <summary>An adopted market comparable of another category than the subject.</summary>
    public const string PropertyTypeMismatch = "m24_property_type_mismatch";
    /// <summary>Physical + functional + external depreciation above 90٪.</summary>
    public const string DepreciationOver90 = "m25_depreciation_over_90";

    /// <summary>Every alert code — a disposition for any other code is refused (round 2).</summary>
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        NoCostLine, ExtendedLifeZero, EffectiveAgeExceedsLife, ObsolescenceOver100, NegativeValues,
        LifeExtensionNoRationale, RepeatedFloorNoArea, ExtraLineNoRationale, RepeatedUnitCostMismatch,
        UseRestrictionNoRationale, NonVacantLandComps, ObsolescenceNoRationale, DeveloperProfitOutOfRange,
        IndirectRatesHigh, NoAdoptedComparables, WeightsNot100, LargeAdjustments, LimitedInspection,
        FewAdoptedComparables, RemoteInspectionUnapproved, ComparableDispersion, ComparableAfterValuationDate,
        PropertyTypeMismatch, DepreciationOver90,
    };

    /// <summary>
    /// Codes of alerts since removed (m20, the stale-comparable time alert; m26–m28, the income
    /// approach's cap rate / expenses / net income alerts, removed with the income approach).
    /// Dispositions stored for them are still round-tripped by the screens, so a save that resends
    /// one is not refused.
    /// </summary>
    public static readonly IReadOnlySet<string> Retired = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "m20_stale_comparable_no_time_adjustment",
        "m26_cap_rate_out_of_range",
        "m27_opex_over_half_egi",
        "m28_noi_not_positive",
    };

    public static bool IsKnown(string? code) => All.Contains((code ?? "").Trim());

    /// <summary>A current or a retired code — what a saved disposition may carry.</summary>
    public static bool IsAcceptedForDisposition(string? code) =>
        IsKnown(code) || Retired.Contains((code ?? "").Trim());
}

public static class ValuationMethodologyAlertSeverityKinds
{
    public const string Hard = "hard";
    public const string RequireRationale = "require_rationale";
    public const string RequireAck = "require_ack";
}

public readonly record struct ValuationMethodologyAlertCheck(
    int Number,
    string Code,
    string LabelAr,
 /// <summary>True when the alert condition fires.</summary>
    bool Triggered,
 /// <summary>True when severity is hard (blocks issuance unconditionally).</summary>
    bool IsHard,
 /// <summary>hard | require_rationale | require_ack</summary>
    string SeverityKind,
 /// <summary>False when required inputs are not modeled yet.</summary>
    bool Evaluated,
 /// <summary>Triggered and still unresolved (hard, or soft without rationale/ack).</summary>
    bool BlocksIssuance,
    string? DetailAr);

/// <summary>Saved override / acknowledgement for a soft methodology alert (audited at save).</summary>
public sealed record ValuationMethodologyAlertResolution(
    string Code,
    string? OverrideRationale = null,
    bool Acknowledged = false);

/// <summary>Alert numbers that block issuance under .</summary>
public static class ValuationMethodologyAlertSeverity
{
 /// <summary>
 /// Hard gates (8): 2 (building ages missing / extended life ≤ 0 — hard since 2026-11-10),
 /// 4, 5, 11, 15, 16 + 21 + 23 (comparable after the valuation date).
 /// </summary>
    public static bool IsHard(int number) => number is 2 or 4 or 5 or 11 or 15 or 16 or 21 or 23;

 /// <summary>
 /// Warning with text rationale (12): 6, 8, 9, 10, 12, 17 + 18 + 19
 /// 3 (age beyond the extended life is explained, not a dead end) + 22 + 24 + 25.
 /// </summary>
    public static bool RequiresRationale(int number) =>
        number is 3 or 6 or 8 or 9 or 10 or 12 or 17 or 18 or 19 or 22 or 24 or 25;

 /// <summary>Warning with acknowledgement (4): 1, 7, 13, 14 (2 left on 2026-11-10 — it is hard now).</summary>
    public static bool RequiresAcknowledgement(int number) =>
        number is 1 or 7 or 13 or 14;

    public static string KindFor(int number) =>
        IsHard(number) ? ValuationMethodologyAlertSeverityKinds.Hard
        : RequiresRationale(number) ? ValuationMethodologyAlertSeverityKinds.RequireRationale
        : ValuationMethodologyAlertSeverityKinds.RequireAck;

}

public sealed record ValuationMethodologyAlertCostLineInput(
    string StructureKind,
    string Label,
    decimal AreaSqm,
    decimal UnitCostSar,
    string? Rationale,
    bool IsIncluded,
    string ItemKey = "");

public sealed record ValuationMethodologyAlertComparableInput(
    string ComparablePropertyType,
    bool ExceedsLargeAdjustmentThreshold,
    decimal SumIncludedPct,
    /// <summary>Adjusted rate per m² (whole-property basis: adjusted total ÷ comparable area); null = not evaluated.</summary>
    decimal? AdjustedUnitRate = null,
    /// <summary>Deal / listing date; null = not evaluated.</summary>
    DateOnly? TransactionDate = null,
    /// <summary>Usage, used only when the type itself is not classifiable.</summary>
    string? Usage = null,
    string? ReferenceCode = null,
    /// <summary>Σ|sequential| + Σ|difference| (shown in the m17 detail).</summary>
    decimal GrossAdjustmentPct = 0m);

public sealed record ValuationMethodologyAlertInput(
    bool HasStructuresToValue,
    bool CostApproachRelevant,
    IReadOnlyList<ValuationMethodologyAlertCostLineInput> CostLines,
    int AdoptedComparableCount,
    bool ComparableWeightsSumTo100,
    bool ReconciliationWeightsSumTo100,
    bool HasReconciliationSaved,
    decimal LiquidationDiscountPct,
    string? LiquidationDiscountRationale,
    IReadOnlyList<ValuationMethodologyAlertComparableInput> AdoptedComparables,
 /// <summary>Optional developer profit % when modeled; null = not evaluated.</summary>
    decimal? DeveloperProfitPct = null,
 /// <summary>Optional sum of indirect cost %; null = not evaluated.</summary>
    decimal? IndirectRatesSumPct = null,
 /// <summary>use-restriction discount on land (alert ).</summary>
    decimal UseRestrictionDiscountPct = 0m,
 /// <summary>. </summary>
    string? UseRestrictionRationale = null,
 /// <summary>null when the cost approach has no age data yet.</summary>
    decimal? ActualAgeYears = null,
 /// <summary>. </summary>
    decimal? EconomicAgeYears = null,
 /// <summary>. </summary>
    decimal LifeExtensionYears = 0m,
    string? LifeExtensionBasis = null,
 /// <summary>Economic age + extension — computed by the cost approach.</summary>
    decimal? ExtendedLifeYears = null,
 /// <summary>computed, unclamped; null when no cost approach saved.</summary>
    decimal? TotalObsolescencePct = null,
 /// <summary>. </summary>
    decimal FunctionalObsolescencePct = 0m,
    string? FunctionalObsolescenceRationale = null,
 /// <summary>. </summary>
    decimal ExternalObsolescencePct = 0m,
    string? ExternalObsolescenceRationale = null,
 /// <summary>Soft-alert resolutions (rationale / ack) keyed by alert code.</summary>
    IReadOnlyList<ValuationMethodologyAlertResolution>? Resolutions = null,
 /// <summary>Inspection scope — null = not captured yet, so m18/m21 are not evaluated.</summary>
    string? InspectionScopeKey = null,
 /// <summary>Count of uninspected units.</summary>
    int UninspectedUnitCount = 0,
 /// <summary>certified-valuer approval for "remote desktop" scope.</summary>
    bool RemoteInspectionApprovedByAccredited = false,
    /// <summary>
    /// Market-approach comparable gates (m15/m16-comps/m17/m19). False when أسلوب السوق is off —
    /// cost-only / «مبنى فقط» must not require adopted market comps.
    /// </summary>
    bool MarketApproachRelevant = true,
    /// <summary>
    /// The cost approach is enabled in the approach settings. False ⇒ every cost-data alert
    /// (m2–m10, m12–m14) is skipped, so figures left from a cost approach the appraiser later
    /// turned off never warn or block issuance.
    /// </summary>
    bool CostApproachEnabled = true,
    /// <summary>
    /// Last date an adopted comparable may carry (retrospective date / period end). Null, or
    /// not before <see cref="Today"/>, = an issuance-date valuation: m23 is not evaluated.
    /// </summary>
    DateOnly? ComparableDateCutoff = null,
    DateOnly? Today = null,
    /// <summary>
    /// Round 2: the cutoff is the END of a retrospective valuation period — alert 23 then names it
    /// «نهاية فترة التقييم», not «تاريخ التقييم».
    /// </summary>
    bool ComparableDateCutoffIsPeriodEnd = false,
    /// <summary>The subject's (effective) property type; null/blank = m24 not evaluated.</summary>
    string? SubjectPropertyType = null,
    /// <summary>
    /// The land comparables adopted inside the cost approach (land_within_cost); null = none.
    /// Only alert 23 reads them, and only while the cost approach is on (2026-11-04, A→Z #77).
    /// </summary>
    IReadOnlyList<ValuationMethodologyAlertComparableInput>? AdoptedCostLandComparables = null);

/// <summary>Evaluates alerts per three-tier severity.</summary>
public static class ValuationMethodologyAlertRules
{
    public const decimal DeveloperProfitMinPct = 10m;
    public const decimal DeveloperProfitMaxPct = 20m;
    public const decimal IndirectRatesWarnPct = 45m;
 /// <summary>Fewer than 3 adopted comparables is a rationale warning.</summary>
    public const int MinComparablesWithoutRationale = 3;

    public static IReadOnlyList<ValuationMethodologyAlertCheck> Evaluate(
        ValuationMethodologyAlertInput input)
    {
        // Cost data only counts while the cost approach is on (stale lines/ages are ignored).
        var costOn = input.CostApproachEnabled;
        var lines = costOn ? input.CostLines.Where(l => l.IsIncluded).ToList() : [];
        // Alert 2 (hard): included building lines while the actual age or the economic life is blank —
        // the same rule the cost screen and the gates ask (CostDepreciationRules.IsIncomplete).
        var agesBlank = costOn && CostDepreciationRules.IsIncomplete(
            input.ActualAgeYears,
            input.EconomicAgeYears,
            lines.Select(l => ((string?)l.ItemKey, (string?)l.StructureKind, (string?)l.Label, l.IsIncluded)));
        var comps = input.AdoptedComparables;
        var resolutions = (input.Resolutions ?? [])
            .Where(r => !string.IsNullOrWhiteSpace(r.Code))
            .GroupBy(r => r.Code.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last(), StringComparer.OrdinalIgnoreCase);
        var dispersionRates = comps
            .Select((c, i) => (Ref: RefOf(c.ReferenceCode, i), Rate: c.AdjustedUnitRate ?? 0m))
            .Where(r => r.Rate > 0m)
            .ToList();
        // Alert 23 checks every adopted deal the value rests on: the market comparables while the
        // market approach is on, and the land comparables inside the cost approach while it is on.
        // Fixed 2026-11-04 (A→Z #77): a land comparable dated after a retrospective valuation date
        // entered the cost approach's land rate with no alert, while the market approach blocked it.
        var datedComps = (input.MarketApproachRelevant ? comps : [])
            .Select((c, i) => (Ref: RefOf(c.ReferenceCode, i), c.TransactionDate))
            .Concat((costOn ? input.AdoptedCostLandComparables ?? [] : [])
                .Select((c, i) => (Ref: $"{RefOf(c.ReferenceCode, i)} (أرض التكلفة)", c.TransactionDate)))
            .ToList();
        var afterCutoff = input.ComparableDateCutoff is { } dateCutoff
            ? datedComps
                .Where(x => x.TransactionDate is { } d && d > dateCutoff)
                .ToList()
            : [];
        // The general class — land or built (2026-11-12): only land against built is a mismatch.
        var subjectCategory = PropertyCategoryRules.GeneralClass(input.SubjectPropertyType);
        var mismatched = comps
            .Select((c, i) => (
                Ref: RefOf(c.ReferenceCode, i),
                Type: c.ComparablePropertyType,
                Category: PropertyCategoryRules.GeneralClass(c.ComparablePropertyType, c.Usage)))
            .Where(x => PropertyCategoryRules.Mismatch(subjectCategory, x.Category))
            .ToList();

        return
        [
            // Only when the cost approach is in use: buildings valued by the market approach alone
            // (e.g. an apartment by comparable sales) need no cost table.
            Eval(1, ValuationMethodologyAlertCodes.NoCostLine, "لا يوجد بند تكلفة",
                input.CostApproachRelevant,
                () => lines.Count == 0,
                NoCostLineDetail(
                    hasExcludedLines: costOn && input.CostLines.Count > 0,
                    inventoryHasLines: input.HasStructuresToValue),
                resolutions),

            // Hard since 2026-11-10 (Fix 5): included building lines with a blank actual age or a blank
            // economic life — or an extended life ≤ 0 — leave the depreciation uncomputable. It used to
            // run only once an age was typed and an acknowledgement cleared it, so a cost approach with
            // no ages priced its buildings as new and still issued.
            Eval(2, ValuationMethodologyAlertCodes.ExtendedLifeZero,
                "عمر المبنى الفعلي والعمر الاقتصادي مطلوبان لحساب الإهلاك",
                costOn && (input.ActualAgeYears is not null || input.EconomicAgeYears is not null || agesBlank),
                () => agesBlank || (input.ExtendedLifeYears ?? 0m) <= 0m,
                BuildingAgesDetail(agesBlank),
                resolutions),

            Eval(3, ValuationMethodologyAlertCodes.EffectiveAgeExceedsLife,
                "العمر الفعلي يتجاوز العمر الممتد",
                costOn && input.ActualAgeYears is not null && (input.ExtendedLifeYears ?? 0m) > 0m,
                () => input.ActualAgeYears! > input.ExtendedLifeYears!,
                "الإهلاك المادي > 100٪ — العمر الفعلي يتجاوز الممتد؛ برّر الأعمار (المبنى قائم ومستخدم) — يُقصَر مجموع الإهلاك على 100٪",
                resolutions),

            Eval(4, ValuationMethodologyAlertCodes.ObsolescenceOver100,
                "مجموع التقادم يتجاوز 100٪",
                costOn && input.TotalObsolescencePct is not null,
                // Physical depreciation beyond 100٪ is capped and explained (m3 + m25); only
                // the functional + external obsolescence the appraiser typed can make this impossible.
                () => Math.Max(0m, input.FunctionalObsolescencePct)
                      + Math.Max(0m, input.ExternalObsolescencePct) > 100m,
                "التقادم الوظيفي + الخارجي > 100٪ — راجع الوظيفي والخارجي",
                resolutions),

            Eval(5, ValuationMethodologyAlertCodes.NegativeValues, "قيم سالبة",
                lines.Count > 0,
                () => lines.Any(l => l.AreaSqm < 0m || l.UnitCostSar < 0m),
                "كمية أو تكلفة الوحدة سالبة في بنود التكلفة",
                resolutions),

            Eval(6, ValuationMethodologyAlertCodes.LifeExtensionNoRationale,
                "تمديد العمر مستخدم بلا بيان",
                costOn,
                // The basis the extension requires is at least 10 characters.
                () => input.LifeExtensionYears > 0m
                      && !JustificationRules.MeetsRequiredMinimum(input.LifeExtensionBasis),
                "التمديد > 0 وبيان الأساس فارغ أو أقل من 10 أحرف",
                resolutions),

 // Repeated-floors line present while the
 // first-floor line is deleted or without area.
            Eval(7, ValuationMethodologyAlertCodes.RepeatedFloorNoArea,
                "بند الأدوار المتكررة بلا مسطح",
                lines.Count > 0,
                () => lines.Any(LooksLikeRepeatedFloor)
                      && !lines.Any(l => LooksLikeFirstFloor(l) && l.AreaSqm > 0m),
                "بند الأدوار المتكررة موجود والدور الأول محذوف أو بلا مسطح",
                resolutions),

            Eval(8, ValuationMethodologyAlertCodes.ExtraLineNoRationale,
                "بند إضافي بلا مبرر",
                lines.Count > 0,
                () => lines.Any(l =>
                    LooksLikeExtra(l) && string.IsNullOrWhiteSpace(l.Rationale)),
                "بند إضافي/أخرى بلا مبرر — احتمال ازدواج",
                resolutions),

            Eval(9, ValuationMethodologyAlertCodes.RepeatedUnitCostMismatch,
                "تكلفة متر المتكررة تخالف الدور الأول",
                lines.Count >= 2,
                () => HasRepeatedUnitCostMismatchWithoutRationale(lines),
                "سعر متر الدور المتكرر يختلف عن الدور الأول بلا مبرر مكتوب",
                resolutions),

            Eval(10, ValuationMethodologyAlertCodes.UseRestrictionNoRationale,
                "خصم تقييد الاستخدام بلا مبرر",
                costOn,
                () => input.UseRestrictionDiscountPct > 0m
                      && !JustificationRules.MeetsRequiredMinimum(input.UseRestrictionRationale),
                "خصم تقييد الاستخدام > 0 والمبرر فارغ أو أقل من 10 أحرف",
                resolutions),

            Eval(11, ValuationMethodologyAlertCodes.NonVacantLandComps,
                "مقارنات غير أرض فضاء",
                input.MarketApproachRelevant && !input.HasStructuresToValue && comps.Count > 0,
                () => comps.Any(c => PropertyCategoryRules.IsBuiltType(c.ComparablePropertyType)),
                BuiltComparablesDetail(comps),
                resolutions),

            Eval(12, ValuationMethodologyAlertCodes.ObsolescenceNoRationale,
                "تقادم وظيفي أو خارجي بلا مبرر",
                costOn,
                () => (input.FunctionalObsolescencePct > 0m
                       && !JustificationRules.MeetsRequiredMinimum(input.FunctionalObsolescenceRationale))
                      || (input.ExternalObsolescencePct > 0m
                          && !JustificationRules.MeetsRequiredMinimum(input.ExternalObsolescenceRationale)),
                "تقادم وظيفي/خارجي مُدخل بلا مبرر (10 أحرف على الأقل)",
                resolutions),

            Eval(13, ValuationMethodologyAlertCodes.DeveloperProfitOutOfRange,
                "أرباح المطور خارج النطاق",
                costOn && input.DeveloperProfitPct is not null,
                () => input.DeveloperProfitPct is { } p
                      && (p < DeveloperProfitMinPct || p > DeveloperProfitMaxPct),
                "أرباح المطور خارج 10٪–20٪",
                resolutions),

            Eval(14, ValuationMethodologyAlertCodes.IndirectRatesHigh,
                "النسب غير المباشرة مرتفعة",
                costOn && input.IndirectRatesSumPct is not null,
                () => input.IndirectRatesSumPct is { } s && s > IndirectRatesWarnPct,
                "مجموع النسب غير المباشرة > 45٪",
                resolutions),

            Eval(15, ValuationMethodologyAlertCodes.NoAdoptedComparables,
                "لا توجد مقارنات معتمدة",
                input.MarketApproachRelevant,
                () => input.AdoptedComparableCount <= 0,
                "صفر مقارن معتمد",
                resolutions),

            Eval(16, ValuationMethodologyAlertCodes.WeightsNot100,
                "مجموع الأوزان النسبية ≠ 100٪",
                true,
                () => (input.MarketApproachRelevant
                       && input.AdoptedComparableCount > 0
                       && !input.ComparableWeightsSumTo100)
                      || (input.HasReconciliationSaved && !input.ReconciliationWeightsSumTo100),
                "أوزان المقارنات أو نسب مشاركة الأساليب ≠ 100٪",
                resolutions),

            Eval(17, ValuationMethodologyAlertCodes.LargeAdjustments,
                "مجموع التسويات > 40٪ (الصافي أو الإجمالي)",
                input.MarketApproachRelevant && comps.Count > 0,
                () => comps.Any(c => c.ExceedsLargeAdjustmentThreshold),
                LargeAdjustmentsDetail(comps),
                resolutions),

 // Evaluated only after inspection scope is captured (inspection-boundaries feature).
            Eval(18, ValuationMethodologyAlertCodes.LimitedInspection,
                "معاينة محدودة تشرح قيودها",
                InspectionScopeKeys.IsKnown(input.InspectionScopeKey),
                () => !string.Equals(
                          (input.InspectionScopeKey ?? "").Trim().ToLowerInvariant(),
                          InspectionScopeKeys.Full,
                          StringComparison.Ordinal)
                      || input.UninspectedUnitCount > 0,
                "المعاينة خارجية/مكتبية أو فيها وحدات غير معاينة — المبرر إلزامي",
                resolutions),

            Eval(19, ValuationMethodologyAlertCodes.FewAdoptedComparables,
                "أقل من 3 مقارنات معتمدة",
                input.MarketApproachRelevant,
                () => input.AdoptedComparableCount is > 0
                          and < MinComparablesWithoutRationale,
                "المقارنات المعتمدة أقل من 3 — برّر الاكتفاء",
                resolutions),

 // Hard gate: certified-valuer approval for "remote desktop" scope.
            Eval(21, ValuationMethodologyAlertCodes.RemoteInspectionUnapproved,
                "معاينة مكتبية بلا اعتماد المقيّم المعتمد",
                InspectionScopeKeys.IsKnown(input.InspectionScopeKey),
                () => string.Equals(
                          (input.InspectionScopeKey ?? "").Trim().ToLowerInvariant(),
                          InspectionScopeKeys.Desktop,
                          StringComparison.Ordinal)
                      && !input.RemoteInspectionApprovedByAccredited,
                "نطاق المعاينة «مكتبية عن بُعد» — لا يمر الإصدار حتى يعتمده المقيّم المعتمد",
                resolutions),

            // Dispersion of the adopted adjusted unit rates.
            Eval(22, ValuationMethodologyAlertCodes.ComparableDispersion,
                "تشتّت المقارنات",
                input.MarketApproachRelevant && dispersionRates.Count >= 2,
                () => MarketApproachRules.IsDispersed(dispersionRates.Select(r => r.Rate).ToList()),
                DispersionDetail(dispersionRates),
                resolutions),

            // Hard: a deal after the valuation date did not exist on that date.
            Eval(23, ValuationMethodologyAlertCodes.ComparableAfterValuationDate,
                input.ComparableDateCutoffIsPeriodEnd
                    ? "مقارن بتاريخ لاحق لنهاية فترة التقييم"
                    : "مقارن بتاريخ لاحق لتاريخ التقييم",
                datedComps.Count > 0
                    && input.ComparableDateCutoff is { } cutoff
                    && input.Today is { } today
                    && cutoff < today,
                () => afterCutoff.Count > 0,
                AfterValuationDateDetail(afterCutoff, input.ComparableDateCutoff, input.ComparableDateCutoffIsPeriodEnd),
                resolutions),

            // General-class mismatch — land against built (vacant-land subjects keep the hard m11 instead).
            Eval(24, ValuationMethodologyAlertCodes.PropertyTypeMismatch,
                "نوع المقارن يخالف نوع العقار محل التقييم",
                input.MarketApproachRelevant
                    && comps.Count > 0
                    && subjectCategory is not null
                    && !(subjectCategory == PropertyCategoryRules.Land && !input.HasStructuresToValue),
                () => mismatched.Count > 0,
                TypeMismatchDetail(subjectCategory, mismatched),
                resolutions),

            // Depreciation total above 90٪ (capped at 100٪ by the cost approach).
            Eval(25, ValuationMethodologyAlertCodes.DepreciationOver90,
                "مجموع الإهلاك يتجاوز 90٪",
                costOn && input.TotalObsolescencePct is not null,
                () => CostApproachRules.ObsolescenceNeedsAlert(input.TotalObsolescencePct!.Value),
                $"مجموع الإهلاك (المادي + الوظيفي + الخارجي) {Pct(input.TotalObsolescencePct ?? 0m)}٪ > 90٪ — قيمة المباني شبه معدومة؛ برّر الأعمار والتقادم",
                resolutions),
        ];
    }

    public static int TriggeredCount(IEnumerable<ValuationMethodologyAlertCheck> checks) =>
        checks.Count(c => c.Triggered);

    public static bool HasBlockingAlerts(IEnumerable<ValuationMethodologyAlertCheck> checks) =>
        checks.Any(c => c.BlocksIssuance);

    public static bool IsResolved(
        int number,
        string code,
        IReadOnlyDictionary<string, ValuationMethodologyAlertResolution> resolutions)
    {
        if (!resolutions.TryGetValue(code, out var r))
            return false;

        // A rationale shorter than 10 characters does not clear a "with rationale" alert.
        if (ValuationMethodologyAlertSeverity.RequiresRationale(number))
            return JustificationRules.MeetsRequiredMinimum(r.OverrideRationale);

        if (ValuationMethodologyAlertSeverity.RequiresAcknowledgement(number))
            return r.Acknowledged;

        return false;
    }

    private static ValuationMethodologyAlertCheck Eval(
        int number,
        string code,
        string labelAr,
        bool canEvaluate,
        Func<bool> triggeredWhen,
        string detailWhenTriggered,
        IReadOnlyDictionary<string, ValuationMethodologyAlertResolution> resolutions)
    {
        if (!canEvaluate)
            return NotYet(number, code, labelAr, "لا ينطبق على هذا الطلب / بيانات غير كافية");

        var triggered = triggeredWhen();
        var severity = ValuationMethodologyAlertSeverity.KindFor(number);
        var isHard = ValuationMethodologyAlertSeverity.IsHard(number);
        var resolved = triggered && IsResolved(number, code, resolutions);
        var blocks = triggered && (isHard || !resolved);

        return new ValuationMethodologyAlertCheck(
            number,
            code,
            labelAr,
            Triggered: triggered,
            IsHard: isHard,
            SeverityKind: severity,
            Evaluated: true,
            BlocksIssuance: blocks,
            DetailAr: triggered ? detailWhenTriggered : null);
    }

    private static ValuationMethodologyAlertCheck NotYet(
        int number,
        string code,
        string labelAr,
        string detail) =>
        new(
            number,
            code,
            labelAr,
            Triggered: false,
            IsHard: ValuationMethodologyAlertSeverity.IsHard(number),
            SeverityKind: ValuationMethodologyAlertSeverity.KindFor(number),
            Evaluated: false,
            BlocksIssuance: false,
            DetailAr: detail);

    private static string Pct(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero)
            .ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

    // Up to two decimals: a median of 4.5 ر.س/م² on farm land must not read as 5.
    private static string Rate(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero)
            .ToString("#,0.##", System.Globalization.CultureInfo.InvariantCulture);

    private static string DateText(DateOnly? date) =>
        date?.ToString("yyyy/MM/dd", System.Globalization.CultureInfo.InvariantCulture) ?? "—";

    private static string RefOf(string? referenceCode, int index) =>
        string.IsNullOrWhiteSpace(referenceCode) ? $"المقارن {index + 1}" : referenceCode.Trim();

    private static string LargeAdjustmentsDetail(IReadOnlyList<ValuationMethodologyAlertComparableInput> comps)
    {
        var over = comps
            .Select((c, i) => (c, i))
            .Where(x => x.c.ExceedsLargeAdjustmentThreshold)
            .Select(x => x.c.GrossAdjustmentPct > 0m
                ? $"{RefOf(x.c.ReferenceCode, x.i)} (الصافي {Pct(x.c.SumIncludedPct)}٪، الإجمالي {Pct(x.c.GrossAdjustmentPct)}٪)"
                : RefOf(x.c.ReferenceCode, x.i))
            .ToList();
        const string prefix =
            "تجاوز عتبة ±40٪ على صافي عوامل الاختلاف أو على إجمالي التسويات (المتتابعة + الاختلاف بالقيمة المطلقة)";
        return (over.Count > 0 ? $"{prefix}: {string.Join("، ", over)}" : prefix)
            + " — التبرير إلزامي مع مراجعة صلاحية المقارن";
    }

    private static string DispersionDetail(IReadOnlyList<(string Ref, decimal Rate)> rates)
    {
        if (rates.Count < 2) return "";
        var values = rates.Select(r => r.Rate).ToList();
        var median = MarketApproachRules.Median(values);
        var deviations = MarketApproachRules.DeviationFromMedianPcts(values);
        var outliers = rates
            .Select((r, i) => (r.Ref, Dev: deviations[i]))
            .Where(x => x.Dev > MarketApproachRules.DispersionMedianDeviationPct)
            .Select(x => $"{x.Ref} ينحرف {Pct(x.Dev)}٪")
            .ToList();
        var cv = MarketApproachRules.CoefficientOfVariationPct(values);
        var parts = new List<string>();
        if (outliers.Count > 0)
            parts.Add($"{string.Join("، ", outliers)} عن وسيط الأسعار المعدّلة {Rate(median)} ر.س/م² (الحد 25٪)");
        parts.Add($"معامل الاختلاف {Pct(cv)}٪ (الحد 15٪)");
        return string.Join(" · ", parts) + " — برّر الإبقاء على المقارن الشاذ أو استبعده";
    }

    private static string AfterValuationDateDetail(
        IReadOnlyList<(string Ref, DateOnly? TransactionDate)> after,
        DateOnly? cutoff,
        bool cutoffIsPeriodEnd)
    {
        var list = after.Select(x => $"{x.Ref} بتاريخ {DateText(x.TransactionDate)}");
        return cutoffIsPeriodEnd
            ? $"{string.Join("، ", list)} — بعد نهاية فترة التقييم {DateText(cutoff)}؛ صفقة لم تكن قائمة خلال فترة التقييم — ألغِ اعتمادها"
            : $"{string.Join("، ", list)} — بعد تاريخ التقييم {DateText(cutoff)}؛ صفقة لم تكن قائمة في تاريخ التقييم — ألغِ اعتمادها";
    }

    private static string TypeMismatchDetail(
        string? subjectCategory,
        IReadOnlyList<(string Ref, string Type, string? Category)> mismatched)
    {
        var list = mismatched.Select(x => $"{x.Ref} ({x.Type} — {PropertyCategoryRules.GeneralClassLabelAr(x.Category)})");
        return $"العقار محل التقييم «{PropertyCategoryRules.GeneralClassLabelAr(subjectCategory)}» والمقارن: {string.Join("، ", list)} — برّر صلاحية المقارن أو استبعده";
    }

    /// <summary>
    /// What: the line is «الأدوار المتكررة» (alerts 7 and 9).
    /// How it works: a line that carries an item key is judged by the key only
    /// (<see cref="CostLineItemKeys.RepeatedFloors"/>, the same key the cost approach derives the
    /// quantity from); the label is read only for a legacy row saved without any key.
    /// Edge cases and what was fixed (2026-11-10): a «custom» line named «دور متكرر» used to count by
    /// its label although the cost approach never derives it; and a key typed «Custom» / with spaces
    /// skipped the key check because it was compared before normalising.
    /// </summary>
    private static bool LooksLikeRepeatedFloor(ValuationMethodologyAlertCostLineInput l)
    {
        if (!string.IsNullOrWhiteSpace(l.ItemKey))
            return CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.RepeatedFloors;
        var label = l.Label ?? "";
        return label.Contains("متكرر", StringComparison.Ordinal)
               || label.Contains("repeated", StringComparison.OrdinalIgnoreCase)
               || label.Contains("typical", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// What: the line is «الدور الأول» — the area and price source of the repeated floors (alerts 7, 9).
    /// How it works: by item key (<see cref="CostLineItemKeys.FirstFloor"/>) whenever the line has one,
    /// matching <see cref="RepeatedFloorRules.IncludedFirstFloor"/>; «دور» + «أول/اول» in the label only for a
    /// legacy row without a key.
    /// Edge cases: fixed 2026-11-10 — a custom line named «الدور الأول» counted as the first floor here
    /// while the cost approach (key only) gave the repeated floors no area, so alert 7 stayed silent.
    /// </summary>
    private static bool LooksLikeFirstFloor(ValuationMethodologyAlertCostLineInput l)
    {
        if (!string.IsNullOrWhiteSpace(l.ItemKey))
            return CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.FirstFloor;
        if (LooksLikeRepeatedFloor(l)) return false;
        var label = l.Label ?? "";
        return (label.Contains("أول", StringComparison.Ordinal)
                || label.Contains("اول", StringComparison.Ordinal))
               && label.Contains("دور", StringComparison.Ordinal)
               || label.Contains("first", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// What: whether a cost line sits in «تكاليف وتجهيزات إضافية» — the screen's costGroupOf.
    /// How it works: a custom item is an extra unless it is a floor (a unit's or a building's own
    /// area, e.g. «مساحة المحل», «المستودع الرئيسي»); legacy lines go by kind and label.
    /// Fixed 2026-10-28: every custom item counted as an extra here while the screen listed a
    /// custom floor under the building areas, so m8 fired on a warehouse's main building.
    /// </summary>
    /// <summary>
    /// An addition line that alert 8 asks a rationale for.
    /// How it works: a known key is an extra only when custom and outside the floor areas
    /// (<see cref="CostLineItemKeys.IsAreaGroup"/>, by kind or by name); a legacy row without a key
    /// is judged by its kind and label.
    /// Edge cases: fixed 2026-11-04 (A→Z #52/#65/#90): a custom «الدور الثاني» / «الميزانين» saved as
    /// «other» was flagged «بند إضافي/أخرى بلا مبرر». An extra that adds nothing (zero quantity or
    /// unit cost) is not flagged — it cannot double-count the floor rate (A→Z #78, «المسبح» at 0).
    /// </summary>
    private static bool LooksLikeExtra(ValuationMethodologyAlertCostLineInput l)
    {
        if (l.AreaSqm <= 0m || l.UnitCostSar <= 0m) return false;
        if (CostLineItemKeys.IsKnown(l.ItemKey))
            return CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.Custom
                   && !CostLineItemKeys.IsAreaGroup(l.ItemKey, l.StructureKind, l.Label);
        var kind = l.StructureKind?.Trim() ?? "";
        var label = l.Label ?? "";
        return kind.Equals(BuildingStructureKinds.Other, StringComparison.OrdinalIgnoreCase)
               || label.Contains("أخرى", StringComparison.Ordinal)
               || label.Contains("اضاف", StringComparison.OrdinalIgnoreCase)
               || label.Contains("extra", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// What: m9 — a repeated-floors line priced differently from the first floor without a
    /// written rationale.
    /// How it works: finds the first-floor line (the repeated floors' area and price source) and
    /// flags any repeated-floors line whose own unit cost is above zero, differs from the first
    /// floor's, and has no rationale.
    /// Edge cases: a repeated-floors unit cost of 0 (left empty) means "inherit the first floor's
    /// price" — the cost screen shows «موروثة من الدور الأول» and prices it at the first floor's
    /// rate (<see cref="CostApproachRules.InheritedUnitCost"/>), so it is never a mismatch. It used
    /// to compare the stored 0 to the first floor's price and fire falsely; now matches the
    /// screen's own check. No first-floor line → not evaluated here (m7 covers it).
    /// </summary>
    private static bool HasRepeatedUnitCostMismatchWithoutRationale(
        IReadOnlyList<ValuationMethodologyAlertCostLineInput> lines)
    {
        var first = lines.FirstOrDefault(LooksLikeFirstFloor);
        if (first is null) return false;

        return lines.Any(l =>
            LooksLikeRepeatedFloor(l)
            && l.UnitCostSar > 0m
            && l.UnitCostSar != first.UnitCostSar
            && string.IsNullOrWhiteSpace(l.Rationale));
    }

    /// <summary>
    /// What: alert 11's detail — the adopted comparables whose type names something built.
    /// How it works: <see cref="PropertyCategoryRules.IsBuiltType"/> — the one classifier the
    /// market approach uses — so «عمارة», «محل تجاري», «مستودع»… count, not only villa/apartment.
    /// Edge cases: names each comparable by its reference code (or «المقارن n»).
    /// </summary>
    private static string BuiltComparablesDetail(IReadOnlyList<ValuationMethodologyAlertComparableInput> comps)
    {
        var built = comps
            .Select((c, i) => (c, i))
            .Where(x => PropertyCategoryRules.IsBuiltType(x.c.ComparablePropertyType))
            .Select(x => $"{RefOf(x.c.ReferenceCode, x.i)} ({x.c.ComparablePropertyType.Trim()})")
            .ToList();
        const string text = "للأرض الفضاء: مقارن مبني — خطر احتساب المبنى مرتين";
        return built.Count > 0 ? $"{text}: {string.Join("، ", built)}" : text;
    }

    /// <summary>
    /// What: alert 2's detail — why depreciation cannot be computed.
    /// How it works: blank ages over priced building lines say so with the cost screen's own message
    /// (<see cref="CostDepreciationRules.IncompleteMessageAr"/>); otherwise the extended life is ≤ 0.
    /// </summary>
    /// <summary>The detail of alert 1 while «جدول حصر المباني» lists nothing to value.</summary>
    public const string NoCostLineInventoryEmptyAr =
        "جدول التكلفة فارغ لأن جدول حصر المباني غير معبّأ — يعبّئه المعاين ويعدّله أخصائي دراسة الحالة؛ بعد استكماله اضغط «سحب من حصر المباني»، أو أضف البنود يدوياً";

    /// <summary>
    /// The detail of alert 1 while «جدول حصر المباني» has lines and no cost line is saved yet: the
    /// lines come down into the cost table as a draft the appraiser reviews, prices and saves — so
    /// this means he has not saved them yet (or deleted them all).
    /// </summary>
    public const string NoCostLineInventoryNotPulledAr =
        "لم تُحفظ بنود التكلفة بعد مع أن جدول حصر المباني معبّأ — راجع «بنود التكلفة المباشرة» في طريقة المقاول وسعّرها ثم اضغط «حفظ بنود التكلفة»";

    /// <summary>The detail of alert 1 while the cost table has lines and every one is left out.</summary>
    public const string NoCostLineAllExcludedAr =
        "كل بنود جدول التكلفة مستبعدة من الحساب — أدرج بنداً واحداً على الأقل";

    /// <summary>
    /// What: the line under alert 1's title — why no cost line counts, and where to go.
    /// How it works: the cost table's lines come down from the inspector's «جدول حصر المباني»
    /// (<paramref name="inventoryHasLines"/>: it lists components that are valued), so an empty cost
    /// table points at the inventory first — not filled, or filled and not pulled.
    /// Edge cases (2026-11-11): the detail read «جدول التكلفة فارغ» only, which did not tell the
    /// appraiser that the problem lies in filling the inventory table. A table whose lines are all
    /// excluded says that instead of «فارغ». Wording only: when the alert fires, its tier and what
    /// clears it are unchanged.
    /// </summary>
    private static string NoCostLineDetail(bool hasExcludedLines, bool inventoryHasLines) =>
        hasExcludedLines ? NoCostLineAllExcludedAr
        : inventoryHasLines ? NoCostLineInventoryNotPulledAr
        : NoCostLineInventoryEmptyAr;

    private static string BuildingAgesDetail(bool agesBlank) =>
        agesBlank
            ? $"{CostDepreciationRules.IncompleteMessageAr} — بنود المباني مُدرجة والعمر الفعلي أو الاقتصادي فارغ؛ لا يُتجاوز هذا التنبيه بإقرار"
            : "العمر الممتد (الاقتصادي + التمديد) ≤ 0 — لا يُحسب الإهلاك؛ أدخل العمر الاقتصادي";
}
