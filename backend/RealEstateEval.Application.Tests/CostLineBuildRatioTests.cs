using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The build ratio enters only area-group (group 1) m² lines — the screen shows the ratio input
/// there and nowhere else, so the server must not shrink any other line by a stored ratio.
/// </summary>
public class CostLineBuildRatioTests
{
    [Fact]
    public void A_custom_other_sqm_line_ignores_a_stored_ratio()
    {
        // area 100 · ratio 50% · unit cost 1,000 → the screen shows 100,000.
        var qty = CostApproachRules.EffectiveQuantity(
            100m, CostLineUnits.Sqm, 50m, CostLineItemKeys.Custom, BuildingStructureKinds.Other);

        Assert.Equal(100m, qty);
        Assert.Equal(100_000m, CostApproachRules.LineTotal(qty, 1_000m));
    }

    [Theory]
    [InlineData(CostLineItemKeys.GroundFloor, BuildingStructureKinds.Other)]
    [InlineData(CostLineItemKeys.UpperAnnex, BuildingStructureKinds.Annex)]
    [InlineData(CostLineItemKeys.Custom, BuildingStructureKinds.Floor)]
    public void Area_group_sqm_lines_apply_the_ratio(string itemKey, string structureKind)
    {
        var qty = CostApproachRules.EffectiveQuantity(
            100m, CostLineUnits.Sqm, 50m, itemKey, structureKind);

        Assert.Equal(50m, qty);
        Assert.Equal(50_000m, CostApproachRules.LineTotal(qty, 1_000m));
    }

    [Theory]
    [InlineData(CostLineItemKeys.Fence, BuildingStructureKinds.Fence, CostLineUnits.Sqm)]
    [InlineData(CostLineItemKeys.Parking, BuildingStructureKinds.Other, CostLineUnits.Sqm)]
    [InlineData(CostLineItemKeys.Custom, BuildingStructureKinds.Annex, CostLineUnits.Sqm)]
    [InlineData(CostLineItemKeys.GroundFloor, BuildingStructureKinds.Floor, CostLineUnits.LinearMeter)]
    public void Lines_without_the_ratio_input_keep_their_quantity(
        string itemKey,
        string structureKind,
        string unit)
    {
        Assert.False(CostApproachRules.BuildRatioApplies(itemKey, structureKind, unit));
        Assert.Equal(
            100m,
            CostApproachRules.EffectiveQuantity(100m, unit, 50m, itemKey, structureKind));
    }

    [Fact]
    public void An_empty_ratio_on_an_area_line_means_the_full_area()
    {
        Assert.Equal(
            100m,
            CostApproachRules.EffectiveQuantity(
                100m, CostLineUnits.Sqm, null, CostLineItemKeys.FirstFloor, BuildingStructureKinds.Floor));
    }
}
