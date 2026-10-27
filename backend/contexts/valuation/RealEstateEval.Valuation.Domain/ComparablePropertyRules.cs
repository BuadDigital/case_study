// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • R2-5 MaxPriceSar (1e12) and PriceError — a bank comparable's price is > 0 and ≤ the maximum.
//  • R2-10 IsFutureTransactionDate / FutureTransactionDateAr — a deal dated after today is refused at entry.
//  • R2-10 UsageOrDefault — the usage entered, else the classification, else what the property type says
//          (سكني / تجاري / صناعي); plain land stays empty.
// ──────────────────────────────────────────────────────────────────────────────────────────────

namespace RealEstateEval.Valuation.Domain;

/// <summary>Validation + price/m² + source-card helpers for the comparable bank scaffold.</summary>
public static class ComparablePropertyRules
{
 /// <summary>Heuristic only — no hard TTL in the package; used for source-card freshness.</summary>
    public const int RecentTransactionDays = 90;

    /// <summary>Largest deal price (SAR) a bank comparable — or a per-valuation price override — may carry.</summary>
    public const decimal MaxPriceSar = 1_000_000_000_000m;

    /// <summary>A bank comparable's price is above zero and at most <see cref="MaxPriceSar"/>; null when acceptable.</summary>
    public static string? PriceError(decimal price) =>
        price <= 0m
            ? "سعر المقارن يجب أن يكون أكبر من صفر"
            : price > MaxPriceSar
                ? "سعر المقارن يتجاوز الحد المعقول (1,000,000,000,000 ر.س)"
                : null;

    /// <summary>Round 2: a deal or listing dated after today did not happen yet — refused at entry.</summary>
    public const string FutureTransactionDateAr = "تاريخ العملية لا يمكن أن يكون بعد تاريخ اليوم";

    /// <summary>The deal / listing date is later than today (Riyadh date).</summary>
    public static bool IsFutureTransactionDate(DateOnly transactionDate, DateOnly today) =>
        transactionDate > today;

    /// <summary>
    /// Round 2: a bank row always carries a usage — the one entered, else the subject's classification
    /// (work-order «التصنيف»), else what its property type says (سكني / تجاري / صناعي). A plain land
    /// type with nothing else stays empty: «Do not invent data».
    /// </summary>
    public static string UsageOrDefault(string? usage, string? classification, string? propertyType)
    {
        if (!string.IsNullOrWhiteSpace(usage)) return usage.Trim();
        if (!string.IsNullOrWhiteSpace(classification)) return classification.Trim();
        return PropertyCategoryRules.Categorize(propertyType) switch
        {
            PropertyCategoryRules.ResidentialBuilt => "سكني",
            PropertyCategoryRules.Commercial => "تجاري",
            PropertyCategoryRules.Industrial => "صناعي",
            _ => "",
        };
    }

    public static decimal ComputePricePerSqm(decimal price, decimal areaSqm)
    {
        if (areaSqm <= 0m) return 0m;
        return Math.Round(price / areaSqm, 2, MidpointRounding.AwayFromZero);
    }

    public static bool IsRecentTransaction(DateOnly transactionDate, DateOnly today) =>
        transactionDate.DayNumber >= today.DayNumber - RecentTransactionDays
        && transactionDate.DayNumber <= today.DayNumber + 1;

    public static string FreshnessKey(DateOnly transactionDate, DateOnly today) =>
        IsRecentTransaction(transactionDate, today) ? "recent" : "stored";

    public static string FreshnessLabelAr(DateOnly transactionDate, DateOnly today) =>
        IsRecentTransaction(transactionDate, today) ? "حديث" : "مخزن";

 /// <summary>computed price/m² deviating this far from the district median flags anomaly.</summary>
    public const decimal AnomalyDeviationPct = 50m;

 /// <summary>Minimum active peers in the district before the median check runs.</summary>
    public const int AnomalyMinPeers = 3;

 /// <summary>
 /// anomaly notice — advisory, never blocking: zero rate, or a rate deviating
 /// more than <see cref="AnomalyDeviationPct"/>% from the district's median.
 /// </summary>
    public static string? PricePerSqmAnomalyNote(
        decimal pricePerSqm,
        IReadOnlyList<decimal> districtPeerRates)
    {
        if (pricePerSqm <= 0m)
            return "تنبيه شذوذ: سعر المتر المحسوب صفر — راجع السعر والمساحة";

        var peers = districtPeerRates.Where(r => r > 0m).OrderBy(r => r).ToList();
        if (peers.Count < AnomalyMinPeers) return null;

        var median = peers.Count % 2 == 1
            ? peers[peers.Count / 2]
            : Math.Round((peers[peers.Count / 2 - 1] + peers[peers.Count / 2]) / 2m, 2);
        if (median <= 0m) return null;

        var deviation = Math.Abs(pricePerSqm - median) / median * 100m;
        if (deviation <= AnomalyDeviationPct) return null;

        return "تنبيه شذوذ: سعر المتر ينحرف "
            + Math.Round(deviation, 0).ToString(System.Globalization.CultureInfo.InvariantCulture)
            + "٪ عن وسيط الحي ("
            + median.ToString("N0", System.Globalization.CultureInfo.InvariantCulture)
            + " ر.س/م²)";
    }
}
