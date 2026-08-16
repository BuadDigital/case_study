namespace RealEstateEval.Domain;

/// <summary>
/// Flattens bank comparable adjustments into Mikyas Word-merge cells.
/// Template uses columns 2/4/6 for the three comparable slots (§8 bank replaces fixed rows).
/// </summary>
public static class ValuationReportFieldAdjustmentFlattenRules
{
    /// <summary>Mikyas column index for adopted slot 0..2 → 2, 4, 6.</summary>
    public static int ColumnForSlot(int slotIndexZeroBased) =>
        slotIndexZeroBased switch
        {
            0 => 2,
            1 => 4,
            2 => 6,
            _ => -1,
        };

    public static string? PercentForFactor(
        IReadOnlyList<ValuationComparableAdjustmentLineDtoLite> lines,
        string factorKey)
    {
        var line = lines.FirstOrDefault(l =>
            l.IsIncluded
            && string.Equals(l.FactorKey, factorKey, StringComparison.OrdinalIgnoreCase));
        return line is null ? null : FormatPct(line.Percent);
    }

    public static string FormatPct(decimal pct) =>
        pct.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>
    /// Writes adj.* field keys used by <see cref="ValuationReportFieldCatalog"/> for one slot.
    /// </summary>
    public static void PutSlotCells(
        IDictionary<string, string?> bag,
        int slotIndexZeroBased,
        IReadOnlyList<ValuationComparableAdjustmentLineDtoLite> lines,
        decimal priceAfterSequential,
        decimal priceAfterDifference,
        decimal sumDifferencePct,
        decimal effectiveWeightPct,
        decimal comparableAreaSqm = 0m,
        string? comparableDistrict = null)
    {
        var col = ColumnForSlot(slotIndexZeroBased);
        if (col < 0) return;

        void Put(string codeFieldKey, string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            bag[codeFieldKey] = value.Trim();
        }

        // ت-3 sequential rows. Ejada has no standalone time factor — ق-5 folds the time gap
        // into تسوية ظروف السوق, so the market % goes only to the market row and the
        // template's time row stays empty (writing it twice would double-apply on upload).
        Put($"adj.{CodeForFinancing(col)}", PercentForFactor(lines, MarketAdjustmentFactorKeys.Financing));
        Put($"adj.{CodeForMarket(col)}", PercentForFactor(lines, MarketAdjustmentFactorKeys.Market));

        var fin = IncludedPct(lines, MarketAdjustmentFactorKeys.Financing);
        var mkt = IncludedPct(lines, MarketAdjustmentFactorKeys.Market);
        if (fin is not null || mkt is not null)
            Put($"adj.{CodeForFinancingMarketSum(col)}", FormatPct((fin ?? 0m) + (mkt ?? 0m)));

        Put($"adj.{CodeForPriceAfterSequential(col)}",
            ValuationReportDisplayRules.FormatMoney(priceAfterSequential));

        // Odd columns — the comparable's raw attributes next to each adjustment row.
        if (comparableAreaSqm > 0m)
            Put($"adj.{CodeForAreaRaw(col)}", FormatPct(comparableAreaSqm));
        Put($"adj.{CodeForLocationRaw(col)}", comparableDistrict);

        // ت-5 difference rows
        Put($"adj.{CodeForArea(col)}", PercentForFactor(lines, MarketAdjustmentFactorKeys.Area));
        Put($"adj.{CodeForLocation(col)}", PercentForFactor(lines, MarketAdjustmentFactorKeys.Location));
        Put($"adj.{CodeForStreetCount(col)}", PercentForFactor(lines, MarketAdjustmentFactorKeys.StreetCount));
        Put($"adj.{CodeForZoningFloors(col)}", PercentForFactor(lines, MarketAdjustmentFactorKeys.Zoning));

        // TransactionType is sequential (ت-3 #29) — already inside priceAfterSequential;
        // mixing it into this sum-then-apply difference row would count it twice.
        var other = lines
            .Where(l => l.IsIncluded && (
                l.FactorKey is MarketAdjustmentFactorKeys.Custom
                    or MarketAdjustmentFactorKeys.Attraction
                    or MarketAdjustmentFactorKeys.Access
                    or MarketAdjustmentFactorKeys.PlotShape
                    or MarketAdjustmentFactorKeys.Topography
                    or MarketAdjustmentFactorKeys.Services
                    or MarketAdjustmentFactorKeys.Restrictions
                    or MarketAdjustmentFactorKeys.Development
                    or MarketAdjustmentFactorKeys.IdealArea
                    or MarketAdjustmentFactorKeys.StreetLengths))
            .Sum(l => l.Percent);
        if (other != 0m)
            Put($"adj.{CodeForOther(col)}", FormatPct(other));

        Put($"adj.{CodeForRelativeSum(col)}", FormatPct(sumDifferencePct));
        Put($"adj.{CodeForAdjustedPpsm(col)}",
            ValuationReportDisplayRules.FormatMoney(priceAfterDifference));
        Put($"adj.{CodeForWeight(col)}", FormatPct(effectiveWeightPct));
    }

    /// <summary>Default row descriptors — set only when absent so computed values (e.g. street count) survive.</summary>
    public static void PutSharedLabels(IDictionary<string, string?> bag)
    {
        PutIfAbsent(bag, "adj.65441", MarketAdjustmentFactorKeys.DefaultLabelAr(MarketAdjustmentFactorKeys.StreetCount));
        PutIfAbsent(bag, "adj.65445", MarketAdjustmentFactorKeys.DefaultLabelAr(MarketAdjustmentFactorKeys.Zoning));
        PutIfAbsent(bag, "adj.65446", "تسويات أخرى");
    }

    private static void PutIfAbsent(IDictionary<string, string?> bag, string key, string? value)
    {
        if (!bag.TryGetValue(key, out var existing) || string.IsNullOrWhiteSpace(existing))
            bag[key] = value;
    }

    private static decimal? IncludedPct(
        IReadOnlyList<ValuationComparableAdjustmentLineDtoLite> lines,
        string factorKey)
    {
        var line = lines.FirstOrDefault(l =>
            l.IsIncluded
            && string.Equals(l.FactorKey, factorKey, StringComparison.OrdinalIgnoreCase));
        return line?.Percent;
    }

    // Column codes from mikyas-report-template-analysis.md.
    // Time row (60101/60103/60105) is deliberately never written — see PutSlotCells.
    private static string CodeForFinancing(int col) => col switch { 2 => "60107", 4 => "60109", 6 => "60111", _ => "" };
    private static string CodeForMarket(int col) => col switch { 2 => "60113", 4 => "60115", 6 => "60117", _ => "" };
    private static string CodeForFinancingMarketSum(int col) => col switch { 2 => "60119", 4 => "60121", 6 => "60123", _ => "" };
    private static string CodeForPriceAfterSequential(int col) => col switch { 2 => "60131", 4 => "60133", 6 => "60135", _ => "" };
    private static string CodeForAreaRaw(int col) => col switch { 2 => "40006", 4 => "40008", 6 => "40010", _ => "" };
    private static string CodeForLocationRaw(int col) => col switch { 2 => "40012", 4 => "40014", 6 => "40016", _ => "" };
    private static string CodeForArea(int col) => col switch { 2 => "40007", 4 => "40009", 6 => "40011", _ => "" };
    private static string CodeForLocation(int col) => col switch { 2 => "40013", 4 => "40015", 6 => "40017", _ => "" };
    private static string CodeForStreetCount(int col) => col switch { 2 => "40019", 4 => "40021", 6 => "40023", _ => "" };
    private static string CodeForZoningFloors(int col) => col switch { 2 => "40043", 4 => "40045", 6 => "40047", _ => "" };
    private static string CodeForOther(int col) => col switch { 2 => "60153", 4 => "60155", 6 => "60157", _ => "" };
    private static string CodeForRelativeSum(int col) => col switch { 2 => "40049", 4 => "40051", 6 => "40053", _ => "" };
    private static string CodeForAdjustedPpsm(int col) => col switch { 2 => "40061", 4 => "40063", 6 => "40065", _ => "" };
    private static string CodeForWeight(int col) => col switch { 2 => "60188", 4 => "60190", 6 => "60192", _ => "" };
}

/// <summary>Lite line shape so Domain flatten rules stay free of Application DTOs.</summary>
public sealed record ValuationComparableAdjustmentLineDtoLite(
    string FactorKey,
    decimal Percent,
    bool IsIncluded);
