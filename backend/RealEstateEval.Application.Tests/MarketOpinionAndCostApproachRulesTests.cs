using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class MarketOpinionAndCostApproachRulesTests
{
    [Fact]
    public void ComputeOpinionValue_area_times_rate()
    {
        Assert.Equal(500_000m, MarketOpinionRules.ComputeOpinionValue(1000m, 500m));
        Assert.Equal(0m, MarketOpinionRules.ComputeOpinionValue(1000m, 0m));
    }

    [Fact]
    public void Cost_line_and_totals()
    {
        Assert.Equal(120_000m, CostApproachRules.LineTotal(200m, 600m));
        var direct = CostApproachRules.SumDirectCost(
        [
            (200m, 600m, true),
            (50m, 400m, false),
        ]);
        Assert.Equal(120_000m, direct);
        Assert.Equal(620_000m, CostApproachRules.CostOpinionWithLand(120_000m, 500_000m));
    }

    [Theory]
    [InlineData("120.5", true, 120.5)]
    [InlineData("120,5", true, 120.5)]
    [InlineData("abc", false, 0)]
    public void TryParseArea(string text, bool ok, decimal expected)
    {
        var parsed = CostApproachRules.TryParseArea(text, out var area);
        Assert.Equal(ok, parsed);
        if (ok) Assert.Equal(expected, area);
    }

    [Fact]
    public void Land_unit_rate_after_discount_clamps_and_defaults_to_zero_discount()
    {
        Assert.Equal(1000m, CostApproachRules.LandUnitRateAfterDiscount(1000m, 0m));
        Assert.Equal(900m, CostApproachRules.LandUnitRateAfterDiscount(1000m, 10m));
        Assert.Equal(0m, CostApproachRules.LandUnitRateAfterDiscount(1000m, 150m));
        Assert.Equal(1000m, CostApproachRules.LandUnitRateAfterDiscount(1000m, -5m));
    }

    [Fact]
    public void Land_value_uses_land_area_not_whole_property_opinion()
    {
        // ث-1 #59/#63: rate × land area — never the whole-property market opinion.
        Assert.Equal(400_000m, CostApproachRules.LandValue(1000m, 400m, null));
    }

    [Fact]
    public void Land_value_apartment_share_overrides_land_area()
    {
        Assert.Equal(80_000m, CostApproachRules.LandValue(1000m, 400m, 80m));
        // Zero/absent share falls back to land area.
        Assert.Equal(400_000m, CostApproachRules.LandValue(1000m, 400m, 0m));
    }

    [Fact]
    public void Financing_pct_formula_annual_times_half_period()
    {
        // ث-3 #90: annual% × (months ÷ 12) × 50%
        Assert.Equal(4m, CostApproachRules.FinancingPct(8m, 12));
        Assert.Equal(6m, CostApproachRules.FinancingPct(8m, 18));
        Assert.Equal(0m, CostApproachRules.FinancingPct(0m, 24));
    }

    [Fact]
    public void Indirect_sum_and_total_cost()
    {
        var sum = CostApproachRules.IndirectSumPct([5m, 3m, 2m], 4m);
        Assert.Equal(14m, sum);
        // #92: direct × (1 + indirect)
        Assert.Equal(1_140_000m, CostApproachRules.TotalCostWithIndirect(1_000_000m, 14m));
        Assert.Equal(50_000m, CostApproachRules.IndirectItemAmount(1_000_000m, 5m));
    }

    [Fact]
    public void Depreciation_chain_physical_total_and_buildings_after()
    {
        // Extended life = economic 40 + extension 10 = 50; actual 25 → physical 50%.
        var extended = CostApproachRules.ExtendedLifeYears(40m, 10m);
        Assert.Equal(50m, extended);
        var physical = CostApproachRules.PhysicalObsolescencePct(25m, extended);
        Assert.Equal(50m, physical);
        var total = CostApproachRules.TotalObsolescencePct(physical, 5m, 3m);
        Assert.Equal(58m, total);
        var depreciation = CostApproachRules.DepreciationValue(1_140_000m, total);
        Assert.Equal(661_200m, depreciation);
        Assert.Equal(478_800m, CostApproachRules.BuildingsAfterDepreciation(1_140_000m, depreciation));
    }

    [Fact]
    public void Physical_obsolescence_unclamped_above_100_for_alert_3()
    {
        // Actual 60 over extended 50 = 120% — must stay unclamped so alert 3 sees it.
        Assert.Equal(120m, CostApproachRules.PhysicalObsolescencePct(60m, 50m));
        // But the depreciation VALUE clamps at 100% so the building never goes negative.
        Assert.Equal(1_000m, CostApproachRules.DepreciationValue(1_000m, 120m));
    }

    [Fact]
    public void Physical_obsolescence_null_without_inputs()
    {
        Assert.Null(CostApproachRules.PhysicalObsolescencePct(null, 50m));
        Assert.Null(CostApproachRules.PhysicalObsolescencePct(25m, 0m));
    }

    [Fact]
    public void Cost_item_catalog_covers_the_15_defined_items()
    {
        // ث-2 #64–79: group 1 (7 مسطحات) + group 2 (8 تجهيزات) + custom.
        Assert.Equal(7, CostLineItemKeys.Group1.Length);
        Assert.Equal(8, CostLineItemKeys.Group2.Length);
        Assert.True(CostLineItemKeys.IsKnown("fence"));
        Assert.False(CostLineItemKeys.IsKnown("garage"));
        Assert.Equal("السور", CostLineItemKeys.LabelAr(CostLineItemKeys.Fence));
        Assert.Equal(CostLineUnits.LinearMeter, CostLineItemKeys.DefaultUnit(CostLineItemKeys.Fence));
        Assert.Equal(CostLineUnits.Count, CostLineItemKeys.DefaultUnit(CostLineItemKeys.Elevator));
        Assert.Equal(CostLineUnits.Sqm, CostLineItemKeys.DefaultUnit(CostLineItemKeys.GroundFloor));
    }

    [Fact]
    public void Cost_units_normalize_and_label()
    {
        Assert.Equal("م.ط", CostLineUnits.LabelAr("lm"));
        Assert.Equal("مقطوع", CostLineUnits.LabelAr("lump"));
        Assert.Equal(CostLineUnits.Sqm, CostLineUnits.Normalize("unknown"));
    }

    [Fact]
    public void Repeated_floor_quantity_derives_from_first_floor_times_count()
    {
        // ق-13.
        Assert.Equal(450m, RepeatedFloorRules.DeriveQuantity(150m, 3));
        Assert.Equal(0m, RepeatedFloorRules.DeriveQuantity(150m, 0));
        Assert.Equal(0m, RepeatedFloorRules.DeriveQuantity(-10m, 3));
    }
}
