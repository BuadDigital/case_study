namespace RealEstateEval.Application.Rules;

/// <summary>
/// Engineering-survey fees: offices are always external counterparties.
/// Live rates and area bounds come from the active <c>PartyFeePricingTable</c>.
/// </summary>
public static class EngineeringSurveyFeeRules
{
    public const string OfficePartyType = InspectorFeeRules.TypeCooperatorOrganization;

    public const decimal SeedTier1MaxM2 = 500m;
    public const decimal SeedTier2MaxM2 = 1000m;
    public const decimal SeedTier3MaxM2 = 1500m;
    public const decimal SeedTier4MaxM2 = 10000m;

    public const decimal SeedTier1FeeSar = 300m;
    public const decimal SeedTier2FeeSar = 450m;
    public const decimal SeedTier3FeeSar = 900m;
    public const decimal SeedTier4FeeSar = 1500m;
    public const decimal SeedTier5FeeSar = 4000m;

    public readonly record struct AreaFeeTier(decimal? MaxAreaM2, decimal FeeSar);

    public static IReadOnlyList<AreaFeeTier> SeedTiers() =>
    [
        new(SeedTier1MaxM2, SeedTier1FeeSar),
        new(SeedTier2MaxM2, SeedTier2FeeSar),
        new(SeedTier3MaxM2, SeedTier3FeeSar),
        new(SeedTier4MaxM2, SeedTier4FeeSar),
        new(null, SeedTier5FeeSar),
    ];

    public static decimal ResolveFeeFromTiers(decimal areaM2, IReadOnlyList<AreaFeeTier> tiers)
    {
        var normalized = NormalizeTiers(tiers);
        foreach (var tier in normalized)
        {
            if (tier.MaxAreaM2 is null || areaM2 <= tier.MaxAreaM2.Value)
                return tier.FeeSar;
        }

        return normalized.Count > 0 ? normalized[^1].FeeSar : 0m;
    }

    /// <summary>
    /// Ensures ≥1 tier, strictly increasing positive closed maxes, and a final open-ended tier.
    /// </summary>
    public static IReadOnlyList<AreaFeeTier> NormalizeTiers(IReadOnlyList<AreaFeeTier> tiers)
    {
        if (tiers is null || tiers.Count == 0)
            return SeedTiers();

        var list = new List<AreaFeeTier>(tiers.Count);
        decimal prevMax = 0m;
        for (var i = 0; i < tiers.Count; i++)
        {
            var fee = Math.Max(0m, tiers[i].FeeSar);
            var isLast = i == tiers.Count - 1;
            if (isLast)
            {
                list.Add(new AreaFeeTier(null, fee));
                continue;
            }

            var max = tiers[i].MaxAreaM2 is > 0m
                ? tiers[i].MaxAreaM2!.Value
                : prevMax + 1m;
            max = Math.Max(prevMax + 1m, max);
            list.Add(new AreaFeeTier(max, fee));
            prevMax = max;
        }

        return list;
    }

    public static bool TryParseAreaM2(string? raw, out decimal areaM2)
    {
        areaM2 = 0m;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var cleaned = raw.Trim()
            .Replace(",", "")
            .Replace("م²", "", StringComparison.Ordinal)
            .Replace("م2", "", StringComparison.Ordinal)
            .Replace(" ", "");
        if (!decimal.TryParse(
                cleaned,
                System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsed))
        {
            return false;
        }

        if (parsed <= 0m) return false;
        areaM2 = parsed;
        return true;
    }

    public static decimal NetFee(decimal agreedFeeSar, decimal supervisorDiscountSar) =>
        InspectorFeeRules.NetFee(agreedFeeSar, supervisorDiscountSar);
}
