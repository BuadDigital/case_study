using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportFieldCostLineFlattenRulesTests
{
    [Fact]
    public void Ground_floor_label_maps_to_7090_triplet()
    {
        var bag = new Dictionary<string, string?>();
        ValuationReportFieldCostLineFlattenRules.PutFromLines(
            bag,
            [
                new ValuationReportFieldCostLineLite(
                    BuildingStructureKinds.Floor,
                    "الدور الأرضي",
                    120m,
                    2500m,
                    true),
            ],
            hasStructuresToValue: true);

        Assert.Equal("120", bag["cost_line.7090"]);
        Assert.Equal(ValuationReportDisplayRules.FormatMoney(2500m), bag["cost_line.7100"]);
        Assert.Equal(ValuationReportDisplayRules.FormatMoney(300_000m), bag["cost_line.7110"]);
    }

    [Fact]
    public void Fence_and_annex_fill_expected_keys_and_annex_sum()
    {
        var bag = new Dictionary<string, string?>();
        ValuationReportFieldCostLineFlattenRules.PutFromLines(
            bag,
            [
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Fence, "سور", 40m, 100m, true),
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Annex, "ملحق أرضي", 20m, 800m, true),
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Annex, "ملحق علوي", 15m, 900m, true),
            ],
            hasStructuresToValue: true);

        Assert.Equal("40", bag["cost_line.7300"]);
        Assert.Equal("20", bag["cost_line.7210"]);
        Assert.Equal("15", bag["cost_line.7240"]);
        Assert.Equal("35", bag["inventory.7270"]);
    }

    [Fact]
    public void Empty_when_no_structures_to_value()
    {
        var bag = new Dictionary<string, string?>();
        ValuationReportFieldCostLineFlattenRules.PutFromLines(
            bag,
            [new ValuationReportFieldCostLineLite(BuildingStructureKinds.Floor, "دور", 10m, 1m, true)],
            hasStructuresToValue: false);

        Assert.Empty(bag);
    }

    [Fact]
    public void Repeated_floors_aggregate_instead_of_overwriting()
    {
        var bag = new Dictionary<string, string?>();
        ValuationReportFieldCostLineFlattenRules.PutFromLines(
            bag,
            [
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Floor, "دور متكرر 1", 100m, 2000m, true),
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Floor, "دور متكرر 2", 100m, 2000m, true),
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Floor, "دور متكرر 3", 50m, 2600m, true),
            ],
            hasStructuresToValue: true);

        Assert.Equal("250", bag["cost_line.7180"]);
        Assert.Equal(ValuationReportDisplayRules.FormatMoney(530_000m), bag["cost_line.7200"]);
 // Weighted average unit: 530,000 / 250 = 2,120
        Assert.Equal(ValuationReportDisplayRules.FormatMoney(2120m), bag["cost_line.7190"]);
    }

    [Fact]
    public void Basement_total_fills_catalog_key_cost_line_6589()
    {
        var bag = new Dictionary<string, string?>();
        ValuationReportFieldCostLineFlattenRules.PutFromLines(
            bag,
            [new ValuationReportFieldCostLineLite(BuildingStructureKinds.Basement, "قبو", 200m, 1500m, true)],
            hasStructuresToValue: true);

        Assert.Equal(ValuationReportDisplayRules.FormatMoney(300_000m), bag["cost_line.6589"]);
        Assert.False(bag.ContainsKey("inventory.6589"));
    }

    [Fact]
    public void Unlabeled_floors_assign_ground_then_first()
    {
        var bag = new Dictionary<string, string?>();
        ValuationReportFieldCostLineFlattenRules.PutFromLines(
            bag,
            [
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Floor, "دور أ", 100m, 1m, true),
                new ValuationReportFieldCostLineLite(BuildingStructureKinds.Floor, "دور ب", 80m, 1m, true),
            ],
            hasStructuresToValue: true);

        Assert.Equal("100", bag["cost_line.7090"]);
        Assert.Equal("80", bag["cost_line.7150"]);
    }
}
