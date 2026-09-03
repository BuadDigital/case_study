using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class MarketApproachRulesTests
{
    [Fact]
    public void ApplySequential_multiplies_in_order()
    {
 // 1000 * 1.10 * 0.95 = 1045
        Assert.Equal(1045m, MarketApproachRules.ApplySequential(1000m, [10m, -5m]));
    }

    [Fact]
    public void Sum_and_thresholds_match_prototype_spec()
    {
        Assert.Equal(40m, MarketApproachRules.SumIncludedPercents([10m, 30m]));
        // Interactive model specification: 1 threshold ±35% — justification is mandatory.
        Assert.True(MarketApproachRules.ExceedsLargeAdjustmentThreshold(36m));
        Assert.True(MarketApproachRules.ExceedsLargeAdjustmentThreshold(-36m));
        Assert.False(MarketApproachRules.ExceedsLargeAdjustmentThreshold(35m));
    }

    [Fact]
    public void DealAgeMonths_uses_days_over_30_44()
    {
        // 91 days ≈ 2.99 months → 3
        Assert.Equal(
            3,
            MarketApproachRules.DealAgeMonths(new DateOnly(2026, 1, 1), new DateOnly(2026, 4, 2)));
        Assert.Equal(
            0,
            MarketApproachRules.DealAgeMonths(new DateOnly(2026, 8, 16), new DateOnly(2026, 7, 1)));
    }

    [Fact]
    public void RoundMarketValue_nearest_power_of_ten()
    {
        Assert.Equal(2_220_000m, MarketOpinionRules.RoundMarketValue(2_217_020m, 4));
        Assert.Equal(2_217_020m, MarketOpinionRules.RoundMarketValue(2_217_020.4m, 0));
    }

    [Fact]
    public void SuggestTransactionTypePct_matches_prototype_kind_defaults()
    {
        // KIND_DEFAULT: executed 0 · offer −5 · limit −8 · bid +6.
        Assert.Equal(0m, MarketApproachRules.SuggestTransactionTypePct("executed", null));
        Assert.Equal(-5m, MarketApproachRules.SuggestTransactionTypePct("offer", null));
        Assert.Equal(-8m, MarketApproachRules.SuggestTransactionTypePct("offer", "asking"));
        Assert.Equal(6m, MarketApproachRules.SuggestTransactionTypePct("offer", "som"));
    }

    [Fact]
    public void EffectiveSequentialPercent_market_manual_kind_suggested()
    {
        // Market conditions are manual — no suggestion replaces zero.
        Assert.Equal(
            0m,
            MarketApproachRules.EffectiveSequentialPercent(
                MarketAdjustmentFactorKeys.Market, 0m, "", true, 2.5m, -5m));
        Assert.Equal(
            3m,
            MarketApproachRules.EffectiveSequentialPercent(
                MarketAdjustmentFactorKeys.Market, 3m, "ارتفاع السوق", true, 2.5m, -5m));
        // The non-input comparator type takes the suggested default.
        Assert.Equal(
            -5m,
            MarketApproachRules.EffectiveSequentialPercent(
                MarketAdjustmentFactorKeys.TransactionType, 0m, "", true, 2.5m, -5m));
        // Writing the justification alone does not eliminate the proposed default — the input percentage is the only nullifier.
        Assert.Equal(
            -5m,
            MarketApproachRules.EffectiveSequentialPercent(
                MarketAdjustmentFactorKeys.TransactionType, 0m, "عرض موثوق", true, 2.5m, -5m));
        Assert.Equal(
            -3m,
            MarketApproachRules.EffectiveSequentialPercent(
                MarketAdjustmentFactorKeys.TransactionType, -3m, "", true, 2.5m, -5m));
    }

    [Fact]
    public void SuggestMarketConditionsPct_from_annual_rate()
    {
        // 4% × 6 / 12 = 2
        Assert.Equal(2m, MarketApproachRules.SuggestMarketConditionsPct(6));
        Assert.Equal(0m, MarketApproachRules.SuggestMarketConditionsPct(0));
    }

    [Fact]
    public void SuggestWeights_closer_to_zero_gets_more()
    {
        var weights = MarketApproachRules.SuggestWeights([5m, 40m]);
        Assert.Equal(2, weights.Count);
        Assert.True(weights[0] > weights[1]);
        Assert.True(MarketApproachRules.WeightsSumTo100(weights));
    }

    [Fact]
    public void SuggestWeights_quantized_to_five_percent_units()
    {
        // Interactive model specification: 20 units x 5% of the largest remainder.
        var weights = MarketApproachRules.SuggestWeights([0m, 0.5m, 12m]);
        Assert.Equal(100m, weights.Sum());
        Assert.All(weights, w => Assert.Equal(0m, w % 5m));
    }

    [Fact]
    public void SuggestWeights_uses_epsilon_half()
    {
        // score0 = 1/(0.5+0)=2; score1 = 1/(0.5+0.5)=1 → 65 or 70 versus 35 or 30 (5% units)
        var weights = MarketApproachRules.SuggestWeights([0m, 0.5m]);
        Assert.True(weights[0] > weights[1]);
        Assert.Equal(100m, weights.Sum());
    }

    [Fact]
    public void WeightedUnitRate()
    {
        Assert.Equal(
            1100m,
            MarketApproachRules.WeightedUnitRate([(1000m, 50m), (1200m, 50m)]));
    }

    [Fact]
    public void RequiresRationale_when_nonzero_included()
    {
        Assert.True(MarketApproachRules.RequiresRationale(5m, true));
        Assert.False(MarketApproachRules.RequiresRationale(0m, true));
        Assert.False(MarketApproachRules.RequiresRationale(5m, false));
    }

    [Fact]
    public void ApplyDifferenceFactorSum_applies_once()
    {
 // 1000 after seq * (1 + 0.08) = 1080
        Assert.Equal(1080m, MarketApproachRules.ApplyDifferenceFactorSum(1000m, 8m));
    }

    [Fact]
    public void ApplyMarketUnitRate_sequential_then_difference()
    {
 // 1000 * 1.10 = 1100; then * 1.05 = 1155
        var (afterSeq, diffSum, afterDiff) = MarketApproachRules.ApplyMarketUnitRate(
            1000m,
            [10m],
            [3m, 2m]);
        Assert.Equal(1100m, afterSeq);
        Assert.Equal(5m, diffSum);
        Assert.Equal(1155m, afterDiff);
    }

    [Fact]
    public void CreateStandardMarketLines_includes_sequential_and_difference()
    {
        var lines = MarketApproachRules.CreateStandardMarketLines(Guid.NewGuid());
        Assert.Equal(
            MarketAdjustmentFactorKeys.StandardSequential.Length
                + MarketAdjustmentFactorKeys.DefaultDifferenceFactors.Length,
            lines.Count);
        Assert.Contains(lines, l => l.FactorKey == MarketAdjustmentFactorKeys.Location);
        Assert.Contains(lines, l => l.FactorKey == MarketAdjustmentFactorKeys.Financing);
        Assert.DoesNotContain(lines, l => l.FactorKey == MarketAdjustmentFactorKeys.Zoning);
    }

    [Fact]
    public void IsSequential_vs_difference()
    {
        Assert.True(MarketAdjustmentFactorKeys.IsSequential(MarketAdjustmentFactorKeys.Market));
        Assert.True(MarketAdjustmentFactorKeys.IsDifferenceFactor(MarketAdjustmentFactorKeys.Location));
        Assert.False(MarketAdjustmentFactorKeys.IsSequential(MarketAdjustmentFactorKeys.Location));
    }

    [Fact]
    public void Adjustment_basis_keys_normalize_and_default_to_per_sqm()
    {
        Assert.True(MarketAdjustmentBasisKeys.IsKnown("price_per_sqm"));
        Assert.True(MarketAdjustmentBasisKeys.IsKnown("whole_property"));
        Assert.False(MarketAdjustmentBasisKeys.IsKnown("other"));
        Assert.Equal(MarketAdjustmentBasisKeys.PricePerSqm, MarketAdjustmentBasisKeys.Normalize(null));
        Assert.Equal(MarketAdjustmentBasisKeys.WholeProperty, MarketAdjustmentBasisKeys.Normalize("WHOLE_PROPERTY"));
    }

    [Fact]
    public void Area_adjustment_sign_smaller_comparable_negative()
    {
        // Ratio 2 → 1 multiple x 5%; The smaller comparison is negative and the larger is positive
        Assert.Equal(-5m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 200m));
        Assert.Equal(5m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 800m));
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 400m));
    }

    [Fact]
    public void Area_multiplier_matches_methodology_table()
    {
        // Specification: Ratio 4 → log₂=2 → 10%; The smaller comparative is negative
        Assert.Equal(-10m, AreaAdjustmentRules.SuggestPct("multiplier", 900m, 200m));
        // Ratio ≈1.994 → round(log₂)≈1 → 5%
        Assert.Equal(
            -5m,
            AreaAdjustmentRules.SuggestPct("multiplier", 900m, 900m / 1.994m));
        // Ratio ≈1.256 → round(log₂)≈0 → 0%
        Assert.Equal(
            0m,
            AreaAdjustmentRules.SuggestPct("multiplier", 900m, 900m / 1.256m));
    }

    [Fact]
    public void Area_amthal_uses_ratio_minus_one()
    {
        // r = 1.5 → (1.5−1)×5 = 2.5%; The comparative is greater → positive
        Assert.Equal(2.5m, AreaAdjustmentRules.SuggestPct("amthal", 600m, 900m));
    }

    [Fact]
    public void Area_choose_method_table_wide()
    {
        // Comparable at 4.5 imposes a multiplier on everyone
        Assert.Equal(
            AreaAdjustmentMethods.Multiplier,
            AreaAdjustmentRules.ChooseMethod(900m, [800m, 600m, 1050m, 200m]));
        Assert.Equal(
            AreaAdjustmentMethods.Amthal,
            AreaAdjustmentRules.ChooseMethod(900m, [800m, 600m, 1050m]));
    }

    [Fact]
    public void Area_adjustment_guards_zero_areas()
    {
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("multiplier", 0m, 500m));
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 0m));
    }

    [Fact]
    public void Anomaly_note_flags_large_deviation_from_district_median()
    {
 // Median of 1000/1100/1200 = 1100; 2000 deviates ~82%.
        Assert.NotNull(ComparablePropertyRules.PricePerSqmAnomalyNote(
            2000m, [1000m, 1100m, 1200m]));
        Assert.Null(ComparablePropertyRules.PricePerSqmAnomalyNote(
            1150m, [1000m, 1100m, 1200m]));
 // Fewer than 3 peers → no median check.
        Assert.Null(ComparablePropertyRules.PricePerSqmAnomalyNote(9000m, [1000m]));
 // Zero rate always flags.
        Assert.NotNull(ComparablePropertyRules.PricePerSqmAnomalyNote(0m, []));
    }
}
