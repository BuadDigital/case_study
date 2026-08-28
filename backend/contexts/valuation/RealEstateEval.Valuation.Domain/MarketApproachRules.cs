using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// One sequential / difference-factor adjustment line on a selected comparable.
/// Sequential lines multiply in order; difference factors sum then apply once (spec ).
/// </summary>
public class ValuationComparableAdjustmentLine
{
    public Guid Id { get; set; }
    public Guid SelectionId { get; set; }
 /// <summary>See <see cref="MarketAdjustmentFactorKeys"/>.</summary>
    public string FactorKey { get; set; } = MarketAdjustmentFactorKeys.Financing;
 /// <summary>Display label — required for custom factors.</summary>
    public string LabelAr { get; set; } = "";
    public decimal Percent { get; set; }
    public string Rationale { get; set; } = "";
 /// <summary>وصف المقارن لهذا العامل (compSpec في النموذج التفاعلي) — نص وصفي لكل خلية.</summary>
    public string? DescriptionAr { get; set; }
 /// <summary>Calc include switch — excluding keeps the row for audit.</summary>
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public ValuationComparableSelection? Selection { get; set; }
}

public static class MarketApproachRules
{
    /// <summary>مواصفة النموذج التفاعلي: تجاوز ±٣٥٪ لمجموع التسويات — التبرير إلزامي مع مراجعة صلاحية المقارن.</summary>
    public const decimal LargeAdjustmentThresholdPct = 35m;
    /// <summary>منطق-التسويات: score = 1 / (|factorsSum| + 0.5).</summary>
    public const decimal WeightEpsilon = 0.5m;
    /// <summary>معدل تغير السوق السنوي الافتراضي (٪) لاقتراح تسوية ظروف السوق.</summary>
    public const decimal DefaultAnnualMarketRatePct = 4m;
    /// <summary>منطق-التسويات: تقريب قيمة السوق لأقرب ١٠^ن (افتراضي ن=٤ → ١٠٬٠٠٠).</summary>
    public const int DefaultValueRoundDecimals = 4;
    /// <summary>متوسط أيام الشهر في منطق-التسويات لحساب عمر الصفقة.</summary>
    public const decimal DaysPerMonth = 30.44m;

 /// <summary>Sequential (multiplicative) application of included percents on a unit rate.</summary>
    public static decimal ApplySequential(decimal basePricePerSqm, IEnumerable<decimal> includedPercents)
    {
        var result = basePricePerSqm;
        foreach (var pct in includedPercents)
            result *= 1m + (pct / 100m);
        return Math.Round(result, 2, MidpointRounding.AwayFromZero);
    }

 /// <summary>Difference factors: sum included % then apply once (spec ).</summary>
    public static decimal ApplyDifferenceFactorSum(decimal priceAfterSequential, decimal sumDifferencePct)
    {
        var result = priceAfterSequential * (1m + sumDifferencePct / 100m);
        return Math.Round(result, 2, MidpointRounding.AwayFromZero);
    }

 /// <summary>
 /// Full unit-rate path: sequential multiply, then difference sum-then-apply.
 /// </summary>
    public static (decimal AfterSequential, decimal DifferenceSumPct, decimal AfterDifference) ApplyMarketUnitRate(
        decimal basePricePerSqm,
        IEnumerable<decimal> sequentialPercents,
        IEnumerable<decimal> differencePercents)
    {
        var afterSeq = ApplySequential(basePricePerSqm, sequentialPercents);
        var diffSum = SumIncludedPercents(differencePercents);
        var afterDiff = ApplyDifferenceFactorSum(afterSeq, diffSum);
        return (afterSeq, diffSum, afterDiff);
    }

 /// <summary>Algebraic sum of included percents.</summary>
    public static decimal SumIncludedPercents(IEnumerable<decimal> includedPercents) =>
        includedPercents.Sum();

    public static bool ExceedsLargeAdjustmentThreshold(decimal factorsSumPct) =>
        Math.Abs(factorsSumPct) > LargeAdjustmentThresholdPct;

    public static int DealAgeMonths(DateOnly transactionDate, DateOnly valuationDate)
    {
        // منطق-التسويات: months = (اليوم − date) / 30.44
        var days = valuationDate.DayNumber - transactionDate.DayNumber;
        if (days <= 0) return 0;
        return (int)Math.Round(days / (double)DaysPerMonth, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// منطق-التسويات: mktSug = round(mktRate × months / 12, 2).
    /// أي قيمة يكتبها المقيّم تلغي المقترح عند الحفظ.
    /// </summary>
    public static decimal SuggestMarketConditionsPct(
        int dealAgeMonths,
        decimal annualMarketRatePct = DefaultAnnualMarketRatePct)
    {
        if (dealAgeMonths <= 0 || annualMarketRatePct == 0m) return 0m;
        return Math.Round(
            annualMarketRatePct * dealAgeMonths / 12m,
            2,
            MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// مواصفة النموذج التفاعلي (KIND_DEFAULT): صفقة منفذة ٠ · عرض قائم −٥ · حد −٨ · سوم +٦.
    /// القيمة مقترحة — أي إدخال يدوي من المقيّم يلغيها.
    /// </summary>
    public static decimal SuggestTransactionTypePct(
        string? transactionKind,
        string? priceDescription)
    {
        if (string.Equals(transactionKind, ComparableTransactionKinds.Executed, StringComparison.Ordinal))
            return 0m;
        if (!string.Equals(transactionKind, ComparableTransactionKinds.Offer, StringComparison.Ordinal))
            return 0m;
        return (priceDescription ?? "").Trim().ToLowerInvariant() switch
        {
            ComparablePriceDescriptions.Asking => -8m,
            ComparablePriceDescriptions.Som => 6m,
            _ => -5m,
        };
    }

    /// <summary>
    /// Effective sequential %: تسوية ظروف السوق يدوية بالكامل (النموذج يعرض عمر الصفقة للاستدلال فقط)؛
    /// تسوية نوع المقارن غير المدخلة تأخذ الافتراضي المقترح (KIND_DEFAULT) بأسلوب «مقترح حتى يُتجاوز».
    /// </summary>
    public static decimal EffectiveSequentialPercent(
        string factorKey,
        decimal storedPercent,
        string? rationale,
        bool isIncluded,
        decimal suggestedMarketPct,
        decimal suggestedKindPct)
    {
        if (!isIncluded) return 0m;
        // «مقترح حتى يُتجاوز» بالنسبة المدخلة فقط — كتابة المبرر وحدها لا تلغي الافتراضي.
        var hasManual = storedPercent != 0m;
        if (hasManual) return storedPercent;
        if (factorKey == MarketAdjustmentFactorKeys.TransactionType) return suggestedKindPct;
        _ = suggestedMarketPct;
        _ = rationale;
        return storedPercent;
    }

 /// <summary>
 /// ق-8-1: مبرر السطر «تخصيص لمقارن بعينه» — إن كان فارغاً يرث مبرر العامل.
 /// </summary>
    public static string EffectiveRationale(string? lineOverride, string? factorRationale)
    {
        var overrideText = lineOverride?.Trim() ?? "";
        return overrideText.Length > 0 ? overrideText : factorRationale?.Trim() ?? "";
    }

 /// <summary>
 /// مواصفة النموذج التفاعلي: score = 1 / (|fSum| + 0.5) ثم توزيع ٢٠ وحدة × ٥٪
 /// بطريقة الباقي الأكبر — فالمجموع ١٠٠٪ بالبناء والأوزان مضاعفات ٥٪.
 /// Input must be difference-factor sums (areaAdj + Σ factors), not sequential.
 /// </summary>
    public static IReadOnlyList<decimal> SuggestWeights(IReadOnlyList<decimal> factorsSums)
    {
        if (factorsSums.Count == 0) return [];
        if (factorsSums.Count == 1) return [100m];

        const int units = 20; // 20 × 5٪ = 100٪
        var raw = factorsSums
            .Select(s => 1m / (WeightEpsilon + Math.Abs(s)))
            .ToList();
        var total = raw.Sum();
        if (total <= 0m)
            total = raw.Count; // degenerate; equal split below

        var exact = raw.Select(r => total <= 0m ? (decimal)units / raw.Count : units * r / total).ToList();
        var floors = exact.Select(e => (int)Math.Floor(e)).ToList();
        var leftover = units - floors.Sum();
        var byRemainder = exact
            .Select((e, i) => (Index: i, Frac: e - floors[i]))
            .OrderByDescending(x => x.Frac)
            .ThenBy(x => x.Index)
            .ToList();
        for (var k = 0; k < leftover && k < byRemainder.Count; k++)
            floors[byRemainder[k].Index] += 1;
        return floors.Select(f => f * 5m).ToList();
    }

    public static bool WeightsSumTo100(IEnumerable<decimal> weights, decimal tolerance = 0.05m) =>
        Math.Abs(weights.Sum() - 100m) <= tolerance;

    public static decimal WeightedUnitRate(
        IReadOnlyList<(decimal adjustedPricePerSqm, decimal weightPct)> rows)
    {
        if (rows.Count == 0) return 0m;
        var sum = rows.Sum(r => r.adjustedPricePerSqm * (r.weightPct / 100m));
        return Math.Round(sum, 2, MidpointRounding.AwayFromZero);
    }

    public static bool RequiresRationale(decimal percent, bool isIncluded) =>
        isIncluded && percent != 0m;

    public static IReadOnlyList<ValuationComparableAdjustmentLine> CreateStandardSequentialLines(
        Guid selectionId)
    {
        return MarketAdjustmentFactorKeys.StandardSequential
            .Select((key, i) => new ValuationComparableAdjustmentLine
            {
                Id = Guid.NewGuid(),
                SelectionId = selectionId,
                FactorKey = key,
                LabelAr = MarketAdjustmentFactorKeys.DefaultLabelAr(key),
                Percent = 0m,
                Rationale = "",
                IsIncluded = true,
                SortOrder = i,
            })
            .ToList();
    }

 /// <summary>Seed default difference-factor rows (area + six logic-doc factors).</summary>
    public static IReadOnlyList<ValuationComparableAdjustmentLine> CreateStandardDifferenceFactorLines(
        Guid selectionId,
        int sortOrderStart = 10)
    {
        return MarketAdjustmentFactorKeys.DefaultDifferenceFactors
            .Select((key, i) => new ValuationComparableAdjustmentLine
            {
                Id = Guid.NewGuid(),
                SelectionId = selectionId,
                FactorKey = key,
                LabelAr = MarketAdjustmentFactorKeys.DefaultLabelAr(key),
                Percent = 0m,
                Rationale = "",
                IsIncluded = true,
                SortOrder = sortOrderStart + i,
            })
            .ToList();
    }

 /// <summary>Sequential + difference seeds for a new selection.</summary>
    public static IReadOnlyList<ValuationComparableAdjustmentLine> CreateStandardMarketLines(
        Guid selectionId)
    {
        var lines = new List<ValuationComparableAdjustmentLine>();
        lines.AddRange(CreateStandardSequentialLines(selectionId));
        lines.AddRange(CreateStandardDifferenceFactorLines(selectionId));
        return lines;
    }
}

/// <summary>طريقة قياس تسوية المساحة.</summary>
public static class AreaAdjustmentMethods
{
    public const string Multiplier = "multiplier";
    public const string Amthal = "amthal";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Multiplier or Amthal;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == Amthal ? Amthal : Multiplier;

    public static string LabelAr(string? value) =>
        Normalize(value) == Amthal ? "الأمثال" : "المضاعف";
}

/// <summary>
/// تسوية المساحة — منطق-التسويات / مواصفة-طريقة-المقارنة.
/// الطريقة موحّدة على كل مقارنات الجدول (أي نسبة ≥ ٢ ⟵ المضاعف للجميع).
/// الإشارة: المقارن الأصغر سالب والأكبر موجب. لا تشمل شكل القطعة.
/// </summary>
public static class AreaAdjustmentRules
{
    /// <summary>معامل المساحة الافتراضي ٥٪ لكل مثل أو مضاعف.</summary>
    public const decimal DefaultAreaFactorPct = 5m;
    /// <summary>عتبة التحويل من الأمثال إلى المضاعف على مستوى الجدول.</summary>
    public const decimal MultiplierRatioThreshold = 2m;

    /// <summary>
    /// اختيار الطريقة مرة واحدة للجدول: إذا بلغت أي نسبة ٢ فأكثر → المضاعف، وإلا الأمثال.
    /// </summary>
    public static string ChooseMethod(
        decimal subjectAreaSqm,
        IEnumerable<decimal> comparableAreas)
    {
        var maxRatio = 1m;
        foreach (var area in comparableAreas)
        {
            if (subjectAreaSqm <= 0m || area <= 0m) continue;
            var ratio = Math.Max(subjectAreaSqm, area) / Math.Min(subjectAreaSqm, area);
            if (ratio > maxRatio) maxRatio = ratio;
        }

        return maxRatio >= MultiplierRatioThreshold
            ? AreaAdjustmentMethods.Multiplier
            : AreaAdjustmentMethods.Amthal;
    }

    public static decimal AreaRatio(decimal subjectAreaSqm, decimal comparableAreaSqm)
    {
        if (subjectAreaSqm <= 0m || comparableAreaSqm <= 0m) return 1m;
        return Math.Max(subjectAreaSqm, comparableAreaSqm)
            / Math.Min(subjectAreaSqm, comparableAreaSqm);
    }

    public static decimal SuggestPct(
        string? method,
        decimal subjectAreaSqm,
        decimal comparableAreaSqm,
        decimal areaFactorPct = DefaultAreaFactorPct)
    {
        if (subjectAreaSqm <= 0m || comparableAreaSqm <= 0m || areaFactorPct == 0m)
            return 0m;
        if (subjectAreaSqm == comparableAreaSqm) return 0m;

        var ratio = AreaRatio(subjectAreaSqm, comparableAreaSqm);
        decimal magnitude;
        if (AreaAdjustmentMethods.Normalize(method) == AreaAdjustmentMethods.Amthal)
        {
            // الأمثال: (الكبيرة − الصغيرة) ÷ الصغيرة × المعامل = (r − 1) × areaFactor
            magnitude = (ratio - 1m) * areaFactorPct;
        }
        else
        {
            // المضاعف: round(log₂ r) × المعامل
            var log2 = (decimal)(Math.Log((double)ratio) / Math.Log(2d));
            magnitude = Math.Round(log2, MidpointRounding.AwayFromZero) * areaFactorPct;
        }

        var sign = comparableAreaSqm < subjectAreaSqm ? -1m : 1m;
        return Math.Round(sign * magnitude, 2, MidpointRounding.AwayFromZero);
    }
}
