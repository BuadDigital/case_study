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
    // 2026-11-04: a custom annex or basement is a building area like the catalog ones.
    [InlineData(CostLineItemKeys.Custom, BuildingStructureKinds.Annex)]
    [InlineData(CostLineItemKeys.Custom, BuildingStructureKinds.Basement)]
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

    /// <summary>A→Z #30/#52/#65/#90 (2026-11-04): floor names outside the catalog, saved as «other».</summary>
    [Theory]
    [InlineData("الدور الثاني", BuildingStructureKinds.Floor)]
    [InlineData("دور ثالث", BuildingStructureKinds.Floor)]
    [InlineData("الميزانين", BuildingStructureKinds.Floor)]
    [InlineData("مسطح الطابق الأول", BuildingStructureKinds.Floor)]
    [InlineData("ملحق علوي", BuildingStructureKinds.Annex)]
    [InlineData("الملحق العلوى", BuildingStructureKinds.Annex)]
    [InlineData("البدروم", BuildingStructureKinds.Basement)]
    public void A_custom_other_line_named_as_a_building_area_is_in_the_area_group(string label, string kind)
    {
        Assert.Equal(kind, CostLineItemKeys.AreaKindForName(label));
        Assert.True(CostLineItemKeys.IsAreaGroup(CostLineItemKeys.Custom, BuildingStructureKinds.Other, label));
        Assert.Equal(
            50m,
            CostApproachRules.EffectiveQuantity(
                100m, CostLineUnits.Sqm, 50m, CostLineItemKeys.Custom, BuildingStructureKinds.Other, label));
    }

    [Theory]
    [InlineData("دورة مياه")]
    [InlineData("غرفة حارس")]
    [InlineData("عزل السطح")]
    [InlineData("مكتبة")]
    [InlineData("")]
    public void Other_names_stay_additions(string label)
    {
        Assert.Null(CostLineItemKeys.AreaKindForName(label));
        Assert.False(CostLineItemKeys.IsAreaGroup(CostLineItemKeys.Custom, BuildingStructureKinds.Other, label));
        // A fence stays an addition whatever it is called.
        Assert.False(CostLineItemKeys.IsAreaGroup(CostLineItemKeys.Custom, BuildingStructureKinds.Fence, "الدور"));
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
