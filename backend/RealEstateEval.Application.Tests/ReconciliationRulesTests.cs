using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ReconciliationRulesTests
{
    [Fact]
    public void Discount_applies_for_liquidation_basis_alone()
    {
        // Interactive Model Specification: The forced sale discount follows the “liquidation value” basis directly.
        Assert.True(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Liquidation,
            ValuePremiseKeys.Orderly,
            20m));
        Assert.True(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Liquidation,
            null,
            20m));
        Assert.False(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Market,
            ValuePremiseKeys.Orderly,
            20m));
        Assert.False(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Liquidation,
            null,
            0m));
    }

    [Fact]
    public void Final_opinion_discounts_then_rounds_once()
    {
        var (_, final, applied) = ReconciliationRules.FinalOpinionWithOptionalDiscount(
            100_000m,
            decimals: 0,
            BasisOfValueKeys.Liquidation,
            ValuePremiseKeys.Forced,
            10m);

        Assert.True(applied);
        Assert.Equal(90_000m, final);
    }

    [Fact]
    public void RoundFinal_rounds_to_nearest_power_of_ten()
    {
        // Interactive model specification: n=4 → nearest 10,000; n=0 → nearest sr.
        Assert.Equal(2_220_000m, ReconciliationRules.RoundFinal(2_217_020m, 4));
        Assert.Equal(2_217_020m, ReconciliationRules.RoundFinal(2_217_020.4m, 0));
        Assert.Equal(2_217_000m, ReconciliationRules.RoundFinal(2_217_020m, 3));
    }

    [Fact]
    public void SuggestWeights_defaults_market_first()
    {
        // Default apW: ALSOQ-100% and cost 0%.
        var both = ReconciliationRules.SuggestWeights(1_000_000m, 900_000m);
        Assert.Equal(100m, both.First(x => x.kind == ValuationApproachKinds.Market).weightPct);
        Assert.Equal(0m, both.First(x => x.kind == ValuationApproachKinds.Cost).weightPct);

        var costOnly = ReconciliationRules.SuggestWeights(0m, 900_000m);
        Assert.Equal(100m, costOnly.First(x => x.kind == ValuationApproachKinds.Cost).weightPct);
    }

    [Fact]
    public void Market_basis_keeps_full_opinion()
    {
        var (before, final, applied) = ReconciliationRules.FinalOpinionWithOptionalDiscount(
            100_000m,
            0,
            BasisOfValueKeys.Market,
            null,
            10m);

        Assert.False(applied);
        Assert.Equal(100_000m, before);
        Assert.Equal(100_000m, final);
    }
}
