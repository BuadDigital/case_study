namespace RealEstateEval.Domain;

/// <summary>
/// Methodology alerts — 21 per package v2 (القرار 16 + 24 + ق-4 + ق-7):
/// 7 hard / 8 require text rationale / 6 require acknowledgement.
/// m18/m21 evaluate only once inspection-scope data is captured (حدود المعاينة).
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
 /// <summary>القرار 24 — معاينة محدودة (خارجية/مكتبية/وحدات غير معاينة) تشرح قيودها.</summary>
    public const string LimitedInspection = "m18_limited_inspection";
 /// <summary>ق-4 — أقل من 3 مقارنات معتمدة (الحاجب «صفر» باقٍ في m15).</summary>
    public const string FewAdoptedComparables = "m19_few_adopted_comparables";
 /// <summary>ق-4 — فارق زمني كبير بلا تسوية ظروف سوق (العتبة إعداد إداري).</summary>
    public const string StaleComparableNoTimeAdjustment = "m20_stale_comparable_no_time_adjustment";
 /// <summary>ق-7 — نطاق «مكتبية عن بُعد» يحتاج اعتماد المقيّم المعتمد (حاجب).</summary>
    public const string RemoteInspectionUnapproved = "m21_remote_inspection_unapproved";
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
 /// <summary>حاجبة (7): 3, 4, 5, 11, 15, 16 + 21 (ق-7)</summary>
    public static bool IsHard(int number) => number is 3 or 4 or 5 or 11 or 15 or 16 or 21;

 /// <summary>تحذيري بمبرر نصي (8): 6, 8, 9, 10, 12, 17 + 18 (القرار 24) + 19 (ق-4)</summary>
    public static bool RequiresRationale(int number) =>
        number is 6 or 8 or 9 or 10 or 12 or 17 or 18 or 19;

 /// <summary>تحذيري بإقرار (6): 1, 2, 7, 13, 14 + 20 (ق-4)</summary>
    public static bool RequiresAcknowledgement(int number) =>
        number is 1 or 2 or 7 or 13 or 14 or 20;

    public static string KindFor(int number) =>
        IsHard(number) ? ValuationMethodologyAlertSeverityKinds.Hard
        : RequiresRationale(number) ? ValuationMethodologyAlertSeverityKinds.RequireRationale
        : ValuationMethodologyAlertSeverityKinds.RequireAck;

 /// <summary>Backward-compatible alias — hard blockers only.</summary>
    public static bool IsHardByDefault(int number) => IsHard(number);
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
 /// <summary>عمر الصفقة بالأشهر عند تاريخ التقييم (m20).</summary>
    int DealAgeMonths = 0,
 /// <summary>هل أُدخلت تسوية ظروف سوق غير صفرية مفعَّلة؟ (m20)</summary>
    bool HasMarketConditionsAdjustment = false);

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
 /// <summary>نطاق المعاينة (القرار 24) — null = لم يُلتقط بعد فلا تُقيَّم m18/m21.</summary>
    string? InspectionScopeKey = null,
 /// <summary>عدد الوحدات غير المعاينة (القرار 24).</summary>
    int UninspectedUnitCount = 0,
 /// <summary>ق-7 — اعتماد المقيّم المعتمد لنطاق «مكتبية عن بُعد».</summary>
    bool RemoteInspectionApprovedByAccredited = false,
 /// <summary>ق-4 — عتبة الفارق الزمني بالأشهر (إعداد إداري، الافتراضي 6).</summary>
    int TimeGapMonthsThreshold = ValuationMethodologyAlertRules.DefaultTimeGapMonths);

/// <summary>Evaluates alerts per three-tier severity.</summary>
public static class ValuationMethodologyAlertRules
{
    public const decimal DeveloperProfitMinPct = 10m;
    public const decimal DeveloperProfitMaxPct = 20m;
    public const decimal IndirectRatesWarnPct = 45m;
 /// <summary>ق-4: اقتراح الحزمة ~6 أشهر — قابل للضبط من إعدادات المنشأة.</summary>
    public const int DefaultTimeGapMonths = 6;
 /// <summary>ق-4: أقل من 3 مقارنات معتمدة تنبيه بمبرر.</summary>
    public const int MinComparablesWithoutRationale = 3;

    public static IReadOnlyList<ValuationMethodologyAlertCheck> Evaluate(
        ValuationMethodologyAlertInput input)
    {
        var lines = input.CostLines.Where(l => l.IsIncluded).ToList();
        var comps = input.AdoptedComparables;
        var resolutions = (input.Resolutions ?? [])
            .Where(r => !string.IsNullOrWhiteSpace(r.Code))
            .GroupBy(r => r.Code.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last(), StringComparer.OrdinalIgnoreCase);

        return
        [
            Eval(1, ValuationMethodologyAlertCodes.NoCostLine, "لا يوجد بند تكلفة",
                input.CostApproachRelevant || input.HasStructuresToValue,
                () => lines.Count == 0,
                "جدول التكلفة فارغ",
                resolutions),

            Eval(2, ValuationMethodologyAlertCodes.ExtendedLifeZero, "العمر الممتد صفر",
                input.ActualAgeYears is not null || input.EconomicAgeYears is not null,
                () => (input.ExtendedLifeYears ?? 0m) <= 0m,
                "العمر الممتد (الاقتصادي + التمديد) ≤ 0",
                resolutions),

            Eval(3, ValuationMethodologyAlertCodes.EffectiveAgeExceedsLife,
                "العمر الفعلي يتجاوز العمر الممتد",
                input.ActualAgeYears is not null && (input.ExtendedLifeYears ?? 0m) > 0m,
                () => input.ActualAgeYears! > input.ExtendedLifeYears!,
                "الإهلاك المادي > ١٠٠٪ — العمر الفعلي يتجاوز الممتد",
                resolutions),

            Eval(4, ValuationMethodologyAlertCodes.ObsolescenceOver100,
                "مجموع التقادم يتجاوز ١٠٠٪",
                input.TotalObsolescencePct is not null,
                () => input.TotalObsolescencePct! > 100m,
                "مجموع التقادم > ١٠٠٪ — راجع الوظيفي والخارجي",
                resolutions),

            Eval(5, ValuationMethodologyAlertCodes.NegativeValues, "قيم سالبة",
                lines.Count > 0,
                () => lines.Any(l => l.AreaSqm < 0m || l.UnitCostSar < 0m),
                "كمية أو تكلفة الوحدة سالبة في بنود التكلفة",
                resolutions),

            Eval(6, ValuationMethodologyAlertCodes.LifeExtensionNoRationale,
                "تمديد العمر مستخدم بلا بيان",
                true,
                () => input.LifeExtensionYears > 0m
                      && string.IsNullOrWhiteSpace(input.LifeExtensionBasis),
                "التمديد > 0 وبيان الأساس فارغ",
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
                true,
                () => input.UseRestrictionDiscountPct > 0m
                      && string.IsNullOrWhiteSpace(input.UseRestrictionRationale),
                "خصم تقييد الاستخدام > 0 والمبرر فارغ",
                resolutions),

            Eval(11, ValuationMethodologyAlertCodes.NonVacantLandComps,
                "مقارنات غير أرض فضاء",
                !input.HasStructuresToValue && comps.Count > 0,
                () => comps.Any(c => LooksBuiltUp(c.ComparablePropertyType)),
                "للأرض الفضاء: مقارن يبدو بمبانٍ — خطر احتساب المبنى مرتين",
                resolutions),

            Eval(12, ValuationMethodologyAlertCodes.ObsolescenceNoRationale,
                "تقادم وظيفي أو خارجي بلا مبرر",
                true,
                () => (input.FunctionalObsolescencePct > 0m
                       && string.IsNullOrWhiteSpace(input.FunctionalObsolescenceRationale))
                      || (input.ExternalObsolescencePct > 0m
                          && string.IsNullOrWhiteSpace(input.ExternalObsolescenceRationale)),
                "تقادم وظيفي/خارجي مُدخل بلا مبرر",
                resolutions),

            Eval(13, ValuationMethodologyAlertCodes.DeveloperProfitOutOfRange,
                "أرباح المطور خارج النطاق",
                input.DeveloperProfitPct is not null,
                () => input.DeveloperProfitPct is { } p
                      && (p < DeveloperProfitMinPct || p > DeveloperProfitMaxPct),
                "أرباح المطور خارج ١٠٪–٢٠٪",
                resolutions),

            Eval(14, ValuationMethodologyAlertCodes.IndirectRatesHigh,
                "النسب غير المباشرة مرتفعة",
                input.IndirectRatesSumPct is not null,
                () => input.IndirectRatesSumPct is { } s && s > IndirectRatesWarnPct,
                "مجموع النسب غير المباشرة > ٤٥٪",
                resolutions),

            Eval(15, ValuationMethodologyAlertCodes.NoAdoptedComparables,
                "لا توجد مقارنات معتمدة",
                true,
                () => input.AdoptedComparableCount <= 0,
                "صفر مقارن معتمد",
                resolutions),

            Eval(16, ValuationMethodologyAlertCodes.WeightsNot100,
                "مجموع الأوزان ≠ ١٠٠٪",
                true,
                () => (input.AdoptedComparableCount > 0 && !input.ComparableWeightsSumTo100)
                      || (input.HasReconciliationSaved && !input.ReconciliationWeightsSumTo100),
                "أوزان المقارنات أو نسب مشاركة الأساليب ≠ 100٪",
                resolutions),

            Eval(17, ValuationMethodologyAlertCodes.LargeAdjustments,
                "مجموع التسويات > ٣٥٪",
                comps.Count > 0,
                () => comps.Any(c => c.ExceedsLargeAdjustmentThreshold
                                     || MarketApproachRules.ExceedsLargeAdjustmentThreshold(c.SumIncludedPct)),
                "تجاوز عتبة التسوية الكبيرة — التبرير إلزامي",
                resolutions),

 // القرار 24 — تُقيَّم فقط بعد التقاط نطاق المعاينة (ميزة حدود المعاينة).
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
                "أقل من ٣ مقارنات معتمدة",
                true,
                () => input.AdoptedComparableCount is > 0
                          and < MinComparablesWithoutRationale,
                "المقارنات المعتمدة أقل من ٣ — برّر الاكتفاء",
                resolutions),

            Eval(20, ValuationMethodologyAlertCodes.StaleComparableNoTimeAdjustment,
                "فارق زمني كبير بلا تسوية زمن",
                comps.Count > 0,
                () => comps.Any(c =>
                    c.DealAgeMonths > Math.Max(1, input.TimeGapMonthsThreshold)
                    && !c.HasMarketConditionsAdjustment),
                "مقارن أقدم من العتبة بلا تسوية ظروف سوق — أقرّ بالوعي (لا عمر صلاحية للمقارنات)",
                resolutions),

 // ق-7 — حاجب اعتماد المقيّم المعتمد لنطاق «مكتبية عن بُعد».
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
        ];
    }

    public static int TriggeredCount(IEnumerable<ValuationMethodologyAlertCheck> checks) =>
        checks.Count(c => c.Triggered);

    public static bool HasHardBlockers(IEnumerable<ValuationMethodologyAlertCheck> checks) =>
        checks.Any(c => c.Triggered && c.IsHard);

    public static bool HasBlockingAlerts(IEnumerable<ValuationMethodologyAlertCheck> checks) =>
        checks.Any(c => c.BlocksIssuance);

    public static bool IsResolved(
        int number,
        string code,
        IReadOnlyDictionary<string, ValuationMethodologyAlertResolution> resolutions)
    {
        if (!resolutions.TryGetValue(code, out var r))
            return false;

        if (ValuationMethodologyAlertSeverity.RequiresRationale(number))
            return !string.IsNullOrWhiteSpace(r.OverrideRationale);

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

    private static bool LooksLikeRepeatedFloor(ValuationMethodologyAlertCostLineInput l)
    {
        if (CostLineItemKeys.IsKnown(l.ItemKey) && l.ItemKey != CostLineItemKeys.Custom)
            return CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.RepeatedFloors;
        var label = l.Label ?? "";
        return label.Contains("متكرر", StringComparison.Ordinal)
               || label.Contains("repeated", StringComparison.OrdinalIgnoreCase)
               || label.Contains("typical", StringComparison.OrdinalIgnoreCase);
    }

    private static bool LooksLikeFirstFloor(ValuationMethodologyAlertCostLineInput l)
    {
        if (CostLineItemKeys.IsKnown(l.ItemKey) && l.ItemKey != CostLineItemKeys.Custom)
            return CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.FirstFloor;
        if (LooksLikeRepeatedFloor(l)) return false;
        var label = l.Label ?? "";
        return (label.Contains("أول", StringComparison.Ordinal)
                || label.Contains("اول", StringComparison.Ordinal))
               && label.Contains("دور", StringComparison.Ordinal)
               || label.Contains("first", StringComparison.OrdinalIgnoreCase);
    }

    private static bool LooksLikeExtra(ValuationMethodologyAlertCostLineInput l)
    {
        if (CostLineItemKeys.IsKnown(l.ItemKey))
            return CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.Custom;
        var kind = l.StructureKind?.Trim() ?? "";
        var label = l.Label ?? "";
        return kind.Equals(BuildingStructureKinds.Other, StringComparison.OrdinalIgnoreCase)
               || label.Contains("أخرى", StringComparison.Ordinal)
               || label.Contains("اضاف", StringComparison.OrdinalIgnoreCase)
               || label.Contains("extra", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasRepeatedUnitCostMismatchWithoutRationale(
        IReadOnlyList<ValuationMethodologyAlertCostLineInput> lines)
    {
        // compares the repeated floor against the FIRST floor (its area source).
        var first = lines.FirstOrDefault(LooksLikeFirstFloor);
        if (first is null) return false;

        return lines.Any(l =>
            LooksLikeRepeatedFloor(l)
            && l.UnitCostSar != first.UnitCostSar
            && string.IsNullOrWhiteSpace(l.Rationale));
    }

    private static bool LooksBuiltUp(string? propertyType)
    {
        var t = (propertyType ?? "").Trim();
        if (t.Length == 0) return false;
        if (t.Contains("أرض", StringComparison.Ordinal) || t.Contains("ارض", StringComparison.Ordinal)
            || t.Contains("land", StringComparison.OrdinalIgnoreCase)
            || t.Contains("فضاء", StringComparison.Ordinal))
            return false;
        return t.Contains("مبنى", StringComparison.Ordinal)
               || t.Contains("فيلا", StringComparison.Ordinal)
               || t.Contains("شقة", StringComparison.Ordinal)
               || t.Contains("دور", StringComparison.Ordinal)
               || t.Contains("building", StringComparison.OrdinalIgnoreCase)
               || t.Contains("villa", StringComparison.OrdinalIgnoreCase)
               || t.Contains("apartment", StringComparison.OrdinalIgnoreCase);
    }
}
