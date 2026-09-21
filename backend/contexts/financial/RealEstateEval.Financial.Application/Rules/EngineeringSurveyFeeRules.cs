namespace RealEstateEval.Application.Rules;

/// <summary>
/// Engineering-survey fees: offices are always external counterparties.
/// Every rate and area bound comes from the active <c>PartyFeePricingTable</c>. There are no seed
/// or fallback amounts here on purpose — an unpriced table must stop the fee, not invent one.
/// </summary>
public static class EngineeringSurveyFeeRules
{
    public const string OfficePartyType = InspectorFeeRules.TypeCooperatorOrganization;

    public readonly record struct AreaFeeTier(decimal? MaxAreaM2, decimal FeeSar);

 /// <summary>
 /// Returns <c>null</c> when the schedule cannot answer — either it has no tiers at all, or the
 /// matching tier was left at zero, which means unset rather than free. Callers surface the
 /// pricing error instead of billing an amount nobody configured.
 /// </summary>
    public static decimal? ResolveFeeFromTiers(decimal areaM2, IReadOnlyList<AreaFeeTier> tiers)
    {
        if (!HasTiers(tiers)) return null;

        var normalized = NormalizeTiers(tiers);
        var matched = normalized[^1];
        foreach (var tier in normalized)
        {
            if (tier.MaxAreaM2 is null || areaM2 <= tier.MaxAreaM2.Value)
            {
                matched = tier;
                break;
            }
        }

        return matched.FeeSar > 0m ? matched.FeeSar : null;
    }

    public static bool HasTiers(IReadOnlyList<AreaFeeTier>? tiers) => tiers is { Count: > 0 };

 /// <summary>
 /// Ensures strictly increasing positive closed maxes and a final open-ended tier. Callers must
 /// reject an empty table first: normalising nothing would mean inventing a price.
 /// </summary>
    public static IReadOnlyList<AreaFeeTier> NormalizeTiers(IReadOnlyList<AreaFeeTier> tiers)
    {
        if (!HasTiers(tiers))
        {
            throw new ArgumentException(
                "جدول التسعير يجب أن يحتوي شريحة واحدة على الأقل.",
                nameof(tiers));
        }

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
