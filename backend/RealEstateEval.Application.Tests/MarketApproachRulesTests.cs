using RealEstateEval.Domain;
using Xunit;

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
    public void Sum_and_threshold()
    {
        Assert.Equal(40m, MarketApproachRules.SumIncludedPercents([10m, 30m]));
        Assert.True(MarketApproachRules.ExceedsLargeAdjustmentThreshold(40m));
        Assert.False(MarketApproachRules.ExceedsLargeAdjustmentThreshold(35m));
    }

    [Fact]
    public void DealAgeMonths_non_negative()
    {
        Assert.Equal(
            14,
            MarketApproachRules.DealAgeMonths(new DateOnly(2025, 6, 1), new DateOnly(2026, 8, 16)));
        Assert.Equal(
            0,
            MarketApproachRules.DealAgeMonths(new DateOnly(2026, 8, 16), new DateOnly(2026, 7, 1)));
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
                + MarketAdjustmentFactorKeys.StandardDifferenceFactors.Length,
            lines.Count);
        Assert.Contains(lines, l => l.FactorKey == MarketAdjustmentFactorKeys.Location);
        Assert.Contains(lines, l => l.FactorKey == MarketAdjustmentFactorKeys.Financing);
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
        // ت-4 note: المقارن الأصغر يأخذ تسوية سالبة والأكبر موجبة.
        Assert.True(AreaAdjustmentRules.SuggestPct("multiplier", 400m, 300m) < 0m);
        Assert.True(AreaAdjustmentRules.SuggestPct("multiplier", 400m, 500m) > 0m);
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 400m));
    }

    [Fact]
    public void Renormalize_scales_auto_suggestions_around_manual_overrides()
    {
        // ق-9/ق-10 — manual 50% on comp 1; comps 2+3 split the remaining 50 pro-rata.
        var result = MarketApproachRules.RenormalizeSuggestions(
            rawSuggestions: [40m, 40m, 20m],
            isManual: [true, false, false],
            manualWeights: [50m, 0m, 0m]);

        Assert.Equal(50m, result[0]);
        Assert.Equal(100m, result.Sum());
        // 40:20 ratio over the 50 remainder → 33.33 / 16.67.
        Assert.True(Math.Abs(result[1] - 33.33m) < 0.02m);
        Assert.True(Math.Abs(result[2] - 16.67m) < 0.02m);
    }

    [Fact]
    public void Renormalize_all_manual_keeps_manual_values()
    {
        var result = MarketApproachRules.RenormalizeSuggestions(
            [50m, 50m], [true, true], [60m, 40m]);
        Assert.Equal(new[] { 60m, 40m }, result);
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

    [Fact]
    public void Area_adjustment_caps_and_guards()
    {
        // Negative side approaches −10 asymptotically (ratio → 0 ⇒ raw → −10).
        Assert.Equal(-9m, AreaAdjustmentRules.SuggestPct("amthal", 400m, 40m));
        Assert.Equal(10m, AreaAdjustmentRules.SuggestPct("amthal", 100m, 1000m));
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("multiplier", 0m, 500m));
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 0m));
    }
}