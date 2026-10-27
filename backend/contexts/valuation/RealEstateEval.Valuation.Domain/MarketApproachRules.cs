// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D4   GrossAdjustmentPct (Σ|sequential| + Σ|difference|); the ±40% rule fires on net OR gross.
//  • D6   Dispersion: Median, deviation from the median (> 25% = outlier), coefficient of variation
//         (> 15% = dispersed), DispersionOutliers / IsDispersed.
//  • D5   Automatic weights scored on the gross adjustment; an outlier gets no automatic weight
//         (SuggestWeights(gross, adjustedRates), DistributeWeights).
//  • D8   OfficialValuationDate (retrospective date, else today) and ComparableDateCutoff (period end).
//  • D10  PropertyCategoryRules — أرض / سكني مبني / تجاري / صناعي from the property type (usage as
//         fallback), and Mismatch for the type-mismatch alert.
// Round 2 (1b19bedc)
//  • R2-5 Header bounds: subject area ≤ 10,000,000 m², area factor 0.1–50%, annual market rate ≤ 50%,
//         rounding 0–6.
//  • R2-7 Comparables blocked by hard alert 23 (dealt after the valuation date) get weight 0 and are left
//         out of the outlier median (HardComparableDateCutoff, ComparableDateCutoffIsPeriodEnd).
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
 /// <summary>Comparable description for this factor (compSpec in interactive model) — descriptive text per cell.</summary>
    public string? DescriptionAr { get; set; }
 /// <summary>Calc include switch — excluding keeps the row for audit.</summary>
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public ValuationComparableSelection? Selection { get; set; }
}

public static class MarketApproachRules
{
    /// <summary>Largest subject area (m²) the market header accepts.</summary>
    public const decimal MaxSubjectAreaSqm = 10_000_000m;
    /// <summary>Allowed range of the frozen area factor (%) a header save may set.</summary>
    public const decimal MinAreaFactorPct = 0.1m;
    public const decimal MaxAreaFactorPct = 50m;
    /// <summary>Allowed range of the frozen annual market rate (%) a header save may set.</summary>
    public const decimal MaxAnnualMarketRatePct = 50m;
    public const int MaxValueRoundDecimals = 6;

    /// <summary>Interactive model spec: ±40% adjustments-sum breach — rationale required with comparable-validity review.</summary>
    public const decimal LargeAdjustmentThresholdPct = 40m;
    /// <summary>Adjustments logic: score = 1 / (|factorsSum| + 0.5).</summary>
    public const decimal WeightEpsilon = 0.5m;
    /// <summary>Default annual market-change rate (%) for suggesting the market-conditions adjustment.</summary>
    public const decimal DefaultAnnualMarketRatePct = 4m;
    /// <summary>Adjustments logic: round market value to nearest 10^n (default n=4 → 10,000).</summary>
    public const int DefaultValueRoundDecimals = 4;
    /// <summary>Average days per month in adjustments logic for deal-age calculation.</summary>
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

    /// <summary>
    /// D4: the ±40٪ rule on the NET difference-factor sum (kept) OR on the GROSS adjustment —
    /// offsetting +30/−30 nets to 0 but is still a 60٪ adjustment and needs a rationale.
    /// </summary>
    public static bool ExceedsLargeAdjustmentThreshold(decimal netDifferencePct, decimal grossAdjustmentPct) =>
        ExceedsLargeAdjustmentThreshold(netDifferencePct)
        || grossAdjustmentPct > LargeAdjustmentThresholdPct;

    /// <summary>
    /// D4/D5: gross adjustment = Σ|sequential %| + Σ|difference %| (included lines only, area
    /// included) — the size of the total correction regardless of signs.
    /// </summary>
    public static decimal GrossAdjustmentPct(
        IEnumerable<decimal> sequentialPercents,
        IEnumerable<decimal> differencePercents) =>
        Math.Round(
            sequentialPercents.Sum(Math.Abs) + differencePercents.Sum(Math.Abs),
            2,
            MidpointRounding.AwayFromZero);

    // ─── D6: dispersion of the adopted comparables ───

    /// <summary>D6: an adjusted unit rate further than 25٪ from the median is an outlier.</summary>
    public const decimal DispersionMedianDeviationPct = 25m;
    /// <summary>D6: coefficient of variation of the adjusted unit rates above 15٪ = dispersed set.</summary>
    public const decimal DispersionCoefficientOfVariationPct = 15m;

    public static decimal Median(IReadOnlyList<decimal> values)
    {
        if (values.Count == 0) return 0m;
        var sorted = values.OrderBy(v => v).ToList();
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 1
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2m;
    }

    /// <summary>|rate − median| ÷ median × 100 per rate (0 when the median is not positive).</summary>
    public static IReadOnlyList<decimal> DeviationFromMedianPcts(IReadOnlyList<decimal> rates)
    {
        var median = Median(rates);
        return rates
            .Select(r => median > 0m
                ? Math.Round(Math.Abs(r - median) / median * 100m, 2, MidpointRounding.AwayFromZero)
                : 0m)
            .ToList();
    }

    /// <summary>Sample standard deviation ÷ mean × 100 (Excel STDEV.S); 0 below two rates.</summary>
    public static decimal CoefficientOfVariationPct(IReadOnlyList<decimal> rates)
    {
        if (rates.Count < 2) return 0m;
        var mean = rates.Average();
        if (mean <= 0m) return 0m;
        var variance = rates.Sum(r => (r - mean) * (r - mean)) / (rates.Count - 1);
        var sd = (decimal)Math.Sqrt((double)variance);
        return Math.Round(sd / mean * 100m, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// D6 outliers: rates deviating more than 25٪ from the median. When every rate is "out"
    /// (e.g. two comparables far apart) there is no reference to judge by — none is flagged here
    /// and the coefficient-of-variation test reports the dispersion instead.
    /// </summary>
    public static IReadOnlyList<bool> DispersionOutliers(IReadOnlyList<decimal> rates)
    {
        if (rates.Count < 2) return rates.Select(_ => false).ToList();
        var deviations = DeviationFromMedianPcts(rates);
        var flags = deviations.Select(d => d > DispersionMedianDeviationPct).ToList();
        return flags.All(f => f) ? flags.Select(_ => false).ToList() : flags;
    }

    /// <summary>D6: any outlier against the median, or the whole set's CV above 15٪.</summary>
    public static bool IsDispersed(IReadOnlyList<decimal> rates) =>
        rates.Count >= 2
        && (DeviationFromMedianPcts(rates).Any(d => d > DispersionMedianDeviationPct)
            || CoefficientOfVariationPct(rates) > DispersionCoefficientOfVariationPct);

    // ─── D8: the official valuation date ───

    /// <summary>
    /// D8: deal age and the time adjustment are measured to the official valuation date — the
    /// retrospective date (or period start) when the appraiser chose one, otherwise today
    /// (the issuance date).
    /// </summary>
    public static DateOnly OfficialValuationDate(
        string? valuationDateMode,
        DateOnly? retrospectiveDate,
        DateOnly today) =>
        ValuationDateModes.Normalize(valuationDateMode) == ValuationDateModes.Retrospective
        && retrospectiveDate is { } date
            ? date
            : today;

    /// <summary>
    /// D8: last date a comparable may carry — the retrospective period end (or the single date);
    /// today for an issuance-date valuation.
    /// </summary>
    public static DateOnly ComparableDateCutoff(
        string? valuationDateMode,
        DateOnly? retrospectiveDate,
        DateOnly? retrospectiveDateEnd,
        DateOnly today) =>
        ValuationDateModes.Normalize(valuationDateMode) == ValuationDateModes.Retrospective
        && retrospectiveDate is { } start
            ? retrospectiveDateEnd is { } end && end > start ? end : start
            : today;

    /// <summary>
    /// Round 2: the cutoff is the end of a retrospective PERIOD (an end date after its start) — the
    /// wording then says «نهاية فترة التقييم».
    /// </summary>
    public static bool ComparableDateCutoffIsPeriodEnd(
        string? valuationDateMode,
        DateOnly? retrospectiveDate,
        DateOnly? retrospectiveDateEnd) =>
        ValuationDateModes.Normalize(valuationDateMode) == ValuationDateModes.Retrospective
        && retrospectiveDate is { } start
        && retrospectiveDateEnd is { } end
        && end > start;

    /// <summary>
    /// The cutoff alert 23 enforces, or null when it is not evaluated (an issuance-date valuation, or a
    /// period that does not end before today) — the same condition the alert itself applies.
    /// </summary>
    public static DateOnly? HardComparableDateCutoff(
        string? valuationDateMode,
        DateOnly? retrospectiveDate,
        DateOnly? retrospectiveDateEnd,
        DateOnly today)
    {
        var cutoff = ComparableDateCutoff(valuationDateMode, retrospectiveDate, retrospectiveDateEnd, today);
        return cutoff < today ? cutoff : null;
    }

    public static int DealAgeMonths(DateOnly transactionDate, DateOnly valuationDate)
    {
        // Adjustments logic: months = (today − date) / 30.44
        var days = valuationDate.DayNumber - transactionDate.DayNumber;
        if (days <= 0) return 0;
        return (int)Math.Round(days / (double)DaysPerMonth, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Adjustments logic: mktSug = round(mktRate × months / 12, 2).
    /// Any value the valuer enters cancels the suggestion on save.
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
    /// Interactive model spec (KIND_DEFAULT): closed deal 0 · active listing −5 · ceiling −8 · som +6.
    /// Value is suggested — any manual entry by the valuer cancels it.
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
    /// Effective sequential %: every sequential factor is pure manual entry — the computed
    /// suggestions (deal-age market conditions, comparable-kind default) are informational only
    /// and never silently substituted as a default. Absent input reads as 0%, not a suggested value.
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
        _ = factorKey;
        _ = suggestedMarketPct;
        _ = suggestedKindPct;
        _ = rationale;
        return storedPercent;
    }

 /// <summary>
 /// Q-8-1: row rationale is a "per-comparable override" — empty inherits the factor rationale.
 /// </summary>
    public static string EffectiveRationale(string? lineOverride, string? factorRationale)
    {
        var overrideText = lineOverride?.Trim() ?? "";
        return overrideText.Length > 0 ? overrideText : factorRationale?.Trim() ?? "";
    }

 /// <summary>
 /// Interactive model spec: score = 1 / (|fSum| + 0.5) then distribute 20 units × 5%
 /// by largest remainder — sum is 100% by construction and weights are multiples of 5%.
 /// Input must be difference-factor sums (areaAdj + Σ factors), not sequential.
 /// </summary>
    public static IReadOnlyList<decimal> SuggestWeights(IReadOnlyList<decimal> factorsSums) =>
        DistributeWeights(factorsSums
            .Select(s => 1m / (WeightEpsilon + Math.Abs(s)))
            .ToList());

    /// <summary>
    /// D5 + D6 automatic weights: score = 1 / (gross adjustment + 0.5), so offsetting +30/−30
    /// no longer looks like "no adjustment"; a comparable whose adjusted unit rate deviates more
    /// than 25٪ from the median gets no automatic weight (the dispersion alert asks the appraiser
    /// to justify or drop it — a manual weight still overrides).
    /// </summary>
    /// <param name="blocked">
    /// Round 2: comparables hard alert 23 blocks (dealt after the valuation date) — no automatic
    /// weight, like an outlier; they are also left out of the outlier median.
    /// </param>
    public static IReadOnlyList<decimal> SuggestWeights(
        IReadOnlyList<decimal> grossAdjustmentPcts,
        IReadOnlyList<decimal> adjustedUnitRates,
        IReadOnlyList<bool>? blocked = null)
    {
        if (grossAdjustmentPcts.Count == 0) return [];
        var isBlocked = blocked is not null && blocked.Count == grossAdjustmentPcts.Count
            ? blocked
            : grossAdjustmentPcts.Select(_ => false).ToList();
        var usable = Enumerable.Range(0, grossAdjustmentPcts.Count).Where(i => !isBlocked[i]).ToList();
        if (usable.Count == 0) return grossAdjustmentPcts.Select(_ => 0m).ToList();
        if (usable.Count == 1)
            return grossAdjustmentPcts.Select((_, i) => isBlocked[i] ? 0m : 100m).ToList();
        var outliers = adjustedUnitRates.Count == grossAdjustmentPcts.Count
            ? DispersionOutliers(usable.Select(i => adjustedUnitRates[i]).ToList())
            : usable.Select(_ => false).ToList();
        var weights = DistributeWeights(usable
            .Select((i, k) => outliers[k] ? 0m : 1m / (WeightEpsilon + Math.Abs(grossAdjustmentPcts[i])))
            .ToList());
        var result = grossAdjustmentPcts.Select(_ => 0m).ToArray();
        for (var k = 0; k < usable.Count; k++) result[usable[k]] = weights[k];
        return result;
    }

    /// <summary>Scores → 20 units × 5% by largest remainder (sum is 100% by construction).</summary>
    private static IReadOnlyList<decimal> DistributeWeights(IReadOnlyList<decimal> raw)
    {
        if (raw.Count == 0) return [];
        if (raw.Count == 1) return [100m];

        const int units = 20; // 20 × 5% = 100%
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
                IsIncluded = MarketAdjustmentFactorKeys.IncludedByDefault(key),
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
                IsIncluded = MarketAdjustmentFactorKeys.IncludedByDefault(key),
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

/// <summary>Area-adjustment measurement method.</summary>
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
/// Area adjustment — adjustments logic / comparison-method spec.
/// Method is unified across all table comparables (any ratio ≥ 2 ⟵ multiplier for all).
/// Sign: smaller comparable negative, larger positive. Does not cover plot shape.
/// </summary>
public static class AreaAdjustmentRules
{
    /// <summary>Default area factor 5% per multiple or multiplier step.</summary>
    public const decimal DefaultAreaFactorPct = 5m;
    /// <summary>Threshold to switch from multiples to multiplier at table level.</summary>
    public const decimal MultiplierRatioThreshold = 2m;

    /// <summary>
    /// Choose the method once per table: if any ratio reaches 2+ → multiplier, else multiples.
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
            // Multiples: (larger − smaller) ÷ smaller × factor = (r − 1) × areaFactor
            magnitude = (ratio - 1m) * areaFactorPct;
        }
        else
        {
            // Multiplier: round(log₂ r) × factor
            var log2 = (decimal)(Math.Log((double)ratio) / Math.Log(2d));
            magnitude = Math.Round(log2, MidpointRounding.AwayFromZero) * areaFactorPct;
        }

        var sign = comparableAreaSqm < subjectAreaSqm ? -1m : 1m;
        return Math.Round(sign * magnitude, 2, MidpointRounding.AwayFromZero);
    }
}

/// <summary>
/// D10: the four comparison categories — أرض / سكني مبني / تجاري / صناعي. Property types are
/// Arabic strings from closed-ish lists (أرض، فيلا، شقة، عمارة، محل تجاري، معرض، مستودع…), so
/// containment on a normalised spelling is the reliable probe. Null = not classifiable (e.g.
/// «مبنى متعدد الاستخدامات»): such a row is never reported as a mismatch.
/// </summary>
public static class PropertyCategoryRules
{
    public const string Land = "land";
    public const string ResidentialBuilt = "residential_built";
    public const string Commercial = "commercial";
    public const string Industrial = "industrial";

    private static readonly string[] BuiltWords =
        ["فيلا", "شقه", "مبني", "عماره", "دور", "منزل", "بيت", "قصر", "معرض", "محل", "مستودع", "مصنع",
         "villa", "apartment", "building", "house"];
    // Written in the approved spelling; matched after the same alef/ta-marbuta normalisation.
    private static readonly string[] LandWords = ["أرض", "فضاء", "land", "plot"];
    private static readonly string[] IndustrialWords =
        ["مستودع", "مصنع", "ورشه", "صناعي", "warehouse", "factory", "industrial"];
    private static readonly string[] CommercialWords =
        ["محل", "معرض", "تجاري", "مكتب", "فندق", "محطه", "مول", "سوق", "عياده", "مستشفي",
         "shop", "showroom", "office", "commercial", "retail", "hotel"];
    private static readonly string[] ResidentialWords =
        ["فيلا", "شقه", "عماره", "منزل", "بيت", "قصر", "دوبلكس", "شاليه", "سكني", "استراحه",
         "villa", "apartment", "duplex", "house", "residential"];

    /// <summary>Category of a property type; the usage only decides when the type says nothing.</summary>
    public static string? Categorize(string? propertyType, string? usage = null) =>
        FromText(propertyType) ?? FromText(usage, landAllowed: false);

    public static string LabelAr(string? category) => category switch
    {
        Land => "أرض",
        ResidentialBuilt => "سكني مبني",
        Commercial => "تجاري",
        Industrial => "صناعي",
        _ => "غير محدد",
    };

    /// <summary>Both sides classified and different.</summary>
    public static bool Mismatch(string? subjectCategory, string? comparableCategory) =>
        subjectCategory is not null
        && comparableCategory is not null
        && !string.Equals(subjectCategory, comparableCategory, StringComparison.Ordinal);

    private static string? FromText(string? text, bool landAllowed = true)
    {
        var t = Normalize(text);
        if (t.Length == 0) return null;
        if (landAllowed && HasAny(t, LandWords) && !HasAny(t, BuiltWords)) return Land;

        // One category only — a mixed description («تجاري سكني») is not classifiable.
        var hits = new List<string>();
        if (HasAny(t, IndustrialWords)) hits.Add(Industrial);
        if (HasAny(t, CommercialWords)) hits.Add(Commercial);
        if (HasAny(t, ResidentialWords)) hits.Add(ResidentialBuilt);
        return hits.Count == 1 ? hits[0] : null;
    }

    private static bool HasAny(string text, string[] words) =>
        words.Any(w => text.Contains(Normalize(w), StringComparison.OrdinalIgnoreCase));

    private static string Normalize(string? value) =>
        (value ?? "")
            .Replace('أ', 'ا')
            .Replace('إ', 'ا')
            .Replace('آ', 'ا')
            .Replace('ٱ', 'ا')
            .Replace('ة', 'ه')
            .Replace('ى', 'ي')
            .Trim();
}
