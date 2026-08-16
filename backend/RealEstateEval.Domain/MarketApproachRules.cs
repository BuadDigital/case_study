namespace RealEstateEval.Domain;

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
 /// <summary>Calc include switch — excluding keeps the row for audit.</summary>
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public ValuationComparableSelection? Selection { get; set; }
}

public static class MarketAdjustmentFactorKeys
{
 // sequential
    public const string Financing = "financing";
    public const string Market = "market";
    public const string TransactionType = "transaction_type";
 // area (treated with difference factors: sum-then-apply)
    public const string Area = "area";
 // difference factors
    public const string IdealArea = "ideal_area";
    public const string Location = "location";
    public const string Attraction = "attraction";
    public const string Access = "access";
    public const string StreetCount = "street_count";
    public const string StreetLengths = "street_lengths";
    public const string PlotShape = "plot_shape";
    public const string Topography = "topography";
    public const string Zoning = "zoning";
    public const string Services = "services";
    public const string Restrictions = "restrictions";
    public const string Development = "development";
    public const string Custom = "custom";

    public static readonly string[] StandardSequential =
        [Financing, Market, TransactionType];

    public static readonly string[] StandardDifferenceFactors =
    [
        Area,
        IdealArea,
        Location,
        Attraction,
        Access,
        StreetCount,
        StreetLengths,
        PlotShape,
        Topography,
        Zoning,
        Services,
        Restrictions,
        Development,
    ];

    public static string DefaultLabelAr(string key) => key switch
    {
        Financing => "تسوية شروط التمويل",
        Market => "تسوية ظروف السوق",
        TransactionType => "تسوية نوع المقارن",
        Area => "تسوية المساحة",
        IdealArea => "المساحة المثالية",
        Location => "الموقع",
        Attraction => "عامل الجذب للموقع",
        Access => "سهولة الوصول",
        StreetCount => "عدد الشوارع",
        StreetLengths => "أطوال الشوارع",
        PlotShape => "شكل القطعة",
        Topography => "طبوغرافيا الأرض",
        Zoning => "تنظيم البناء",
        Services => "الخدمات والبنية التحتية",
        Restrictions => "القيود والارتفاقات",
        Development => "حالة التطوير",
        _ => "عامل مضاف",
    };

    public static bool IsSequential(string? key) =>
        key is Financing or Market or TransactionType;

    public static bool IsDifferenceFactor(string? key) =>
        key is Area or IdealArea or Location or Attraction or Access
            or StreetCount or StreetLengths or PlotShape or Topography
            or Zoning or Services or Restrictions or Development or Custom;

    public static bool IsKnown(string? key) =>
        IsSequential(key) || IsDifferenceFactor(key);
}

/// <summary>
/// Market-approach calc — sequential multiply → difference sum-then-apply → weights.
/// </summary>
public static class MarketApproachRules
{
    public const decimal LargeAdjustmentThresholdPct = 35m;
    private const decimal WeightEpsilon = 0.01m;

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
 // Re-apply without intermediate round for chain, then round once at end of each stage
 // (ApplySequential already rounds; ApplyDifferenceFactorSum rounds again — acceptable scaffold).
        var diffSum = SumIncludedPercents(differencePercents);
        var afterDiff = ApplyDifferenceFactorSum(afterSeq, diffSum);
        return (afterSeq, diffSum, afterDiff);
    }

 /// <summary>Algebraic sum of included percents.</summary>
    public static decimal SumIncludedPercents(IEnumerable<decimal> includedPercents) =>
        includedPercents.Sum();

    public static bool ExceedsLargeAdjustmentThreshold(decimal sumIncludedPct) =>
        Math.Abs(sumIncludedPct) > LargeAdjustmentThresholdPct;

    public static int DealAgeMonths(DateOnly transactionDate, DateOnly valuationDate)
    {
        var months = (valuationDate.Year - transactionDate.Year) * 12
            + (valuationDate.Month - transactionDate.Month);
        if (valuationDate.Day < transactionDate.Day) months--;
        return Math.Max(0, months);
    }

 /// <summary>
 // closer absolute sum-of-adjustments to zero → higher weight.
 /// </summary>
    public static IReadOnlyList<decimal> SuggestWeights(IReadOnlyList<decimal> sumIncludedPercents)
    {
        if (sumIncludedPercents.Count == 0) return [];
        if (sumIncludedPercents.Count == 1) return [100m];

        var raw = sumIncludedPercents
            .Select(s => 1m / (WeightEpsilon + Math.Abs(s)))
            .ToList();
        var total = raw.Sum();
        if (total <= 0m)
            return Enumerable.Repeat(
                    Math.Round(100m / sumIncludedPercents.Count, 2, MidpointRounding.AwayFromZero),
                    sumIncludedPercents.Count)
                .ToList();

        var weights = raw
            .Select(r => Math.Round(100m * r / total, 2, MidpointRounding.AwayFromZero))
            .ToList();

        var drift = 100m - weights.Sum();
        weights[^1] = Math.Round(weights[^1] + drift, 2, MidpointRounding.AwayFromZero);
        return weights;
    }

 /// <summary>
 /// mixed manual + suggested weights: the non-manual comparables'
 /// suggestions rescale into the remainder (100 − Σmanual) so a partial override
 /// still sums to 100 instead of hard-blocking issuance.
 /// </summary>
    public static IReadOnlyList<decimal> RenormalizeSuggestions(
        IReadOnlyList<decimal> rawSuggestions,
        IReadOnlyList<bool> isManual,
        IReadOnlyList<decimal> manualWeights)
    {
        if (rawSuggestions.Count == 0) return [];

        var manualSum = 0m;
        var autoRawSum = 0m;
        var autoCount = 0;
        for (var i = 0; i < rawSuggestions.Count; i++)
        {
            if (i < isManual.Count && isManual[i])
            {
                manualSum += i < manualWeights.Count ? manualWeights[i] : 0m;
            }
            else
            {
                autoRawSum += rawSuggestions[i];
                autoCount++;
            }
        }

        var remainder = Math.Max(0m, 100m - manualSum);
        var result = new decimal[rawSuggestions.Count];
        var lastAutoIndex = -1;
        for (var i = 0; i < rawSuggestions.Count; i++)
        {
            if (i < isManual.Count && isManual[i])
            {
                result[i] = i < manualWeights.Count ? manualWeights[i] : 0m;
                continue;
            }

            result[i] = autoRawSum > 0m
                ? Math.Round(remainder * rawSuggestions[i] / autoRawSum, 2, MidpointRounding.AwayFromZero)
                : autoCount > 0
                    ? Math.Round(remainder / autoCount, 2, MidpointRounding.AwayFromZero)
                    : 0m;
            lastAutoIndex = i;
        }

 // Fold rounding drift into the last auto row so the total lands exactly.
        if (lastAutoIndex >= 0)
        {
            var drift = manualSum + remainder - result.Sum();
            result[lastAutoIndex] = Math.Round(
                result[lastAutoIndex] + drift, 2, MidpointRounding.AwayFromZero);
        }

        return result;
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

 /// <summary>Seed standard difference-factor rows (0%, included).</summary>
    public static IReadOnlyList<ValuationComparableAdjustmentLine> CreateStandardDifferenceFactorLines(
        Guid selectionId,
        int sortOrderStart = 10)
    {
        return MarketAdjustmentFactorKeys.StandardDifferenceFactors
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
/// computed area-adjustment suggestion. Sign per the inventory note:
/// smaller comparable → negative, larger → positive; excludes plot shape/regularity.
/// Magnitude is a provisional scaffold (1% per 10% area difference, capped ±10%)
/// until the v3 منطق-التسويات formulas arrive — the method key is stored so the
/// real المضاعف/الأمثال curves can slot in without a data change.
/// </summary>
public static class AreaAdjustmentRules
{
    public const decimal MaxAbsPct = 10m;

    public static decimal SuggestPct(string? method, decimal subjectAreaSqm, decimal comparableAreaSqm)
    {
        _ = AreaAdjustmentMethods.Normalize(method);
        if (subjectAreaSqm <= 0m || comparableAreaSqm <= 0m) return 0m;

        var raw = (comparableAreaSqm / subjectAreaSqm - 1m) * 10m;
        return Math.Round(
            Math.Clamp(raw, -MaxAbsPct, MaxAbsPct),
            2, MidpointRounding.AwayFromZero);
    }
}
