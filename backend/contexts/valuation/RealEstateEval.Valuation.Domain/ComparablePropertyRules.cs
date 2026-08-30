namespace RealEstateEval.Valuation.Domain;

/// <summary>Validation + price/m² + source-card helpers for the comparable bank scaffold.</summary>
public static class ComparablePropertyRules
{
 /// <summary>Heuristic only — no hard TTL in the package; used for source-card freshness.</summary>
    public const int RecentTransactionDays = 90;

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
