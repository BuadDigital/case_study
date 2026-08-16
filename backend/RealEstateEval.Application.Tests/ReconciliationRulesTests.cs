using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class ReconciliationRulesTests
{
    [Fact]
    public void Discount_applies_only_for_liquidation_with_premise()
    {
        Assert.True(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Liquidation,
            ValuePremiseKeys.Orderly,
            20m));
        Assert.False(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Market,
            ValuePremiseKeys.Orderly,
            20m));
        Assert.False(ReconciliationRules.ShouldApplyLiquidationDiscount(
            BasisOfValueKeys.Liquidation,
            null,
            20m));
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
