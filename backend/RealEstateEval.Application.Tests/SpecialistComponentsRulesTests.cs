using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

public class SpecialistComponentsRulesTests
{
    private static WorkOrderProperty Property(
        string? text = null,
        int lines = 0,
        string propertyType = "",
        string? inspectedType = null)
    {
        var property = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            PropertyType = propertyType,
            InspectedPropertyType = inspectedType,
            SpecialistComponentsText = text,
        };
        for (var i = 0; i < lines; i++)
        {
            property.BuildingInventoryLines.Add(new BuildingInventoryLine
            {
                Id = Guid.NewGuid(),
                PropertyId = property.Id,
                StructureKind = "floor",
                Label = $"بند {i}",
            });
        }

        return property;
    }

    [Fact]
    public void Text_and_a_line_clear_a_property_with_structures()
    {
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(
            Property("فيلا", lines: 1, inspectedType: "فيلا")));
    }

    [Fact]
    public void Structures_need_at_least_one_inventory_line()
    {
        var missing = SpecialistComponentsRules.MissingForAcceptance(
            Property("فيلا", lines: 0, inspectedType: "فيلا"));

        Assert.Equal(SpecialistComponentsRules.InventoryRequired, missing["inventoryLines"]);
        Assert.False(missing.ContainsKey("componentsText"));
    }

    [Fact]
    public void Both_reasons_are_reported_together()
    {
        var missing = SpecialistComponentsRules.MissingForAcceptance(Property(text: "  ", inspectedType: "عمارة"));

        Assert.Equal(SpecialistComponentsRules.TextRequired, missing["componentsText"]);
        Assert.Equal(SpecialistComponentsRules.InventoryRequired, missing["inventoryLines"]);
        Assert.Equal(2, missing.Count);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no")]
    public void A_land_without_a_yes_answer_needs_the_text_only(string? answer)
    {
        // «no» (annexes irrelevant to valuation), unanswered, and legacy land submissions are all exempt.
        var missing = SpecialistComponentsRules.MissingForAcceptance(
            Property(text: null, lines: 0, inspectedType: "أرض"), answer);
        Assert.Equal(["componentsText"], missing.Keys);

        var property = Property("أرض فضاء", lines: 0, inspectedType: "أرض");
        Assert.False(SpecialistComponentsRules.HasStructures(property, answer));
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(property, answer));
    }

    [Fact]
    public void A_land_with_valuable_structures_needs_the_table_even_though_it_is_land()
    {
        var property = Property("أرض وسور وغرفة حارس", lines: 0, inspectedType: "أرض");

        Assert.True(SpecialistComponentsRules.IsInspectedLand(property));
        Assert.True(SpecialistComponentsRules.HasStructures(property, "yes"));
        Assert.Equal(SpecialistComponentsRules.InventoryRequired,
            SpecialistComponentsRules.MissingForAcceptance(property, "yes")["inventoryLines"]);

        property.BuildingInventoryLines.Add(new BuildingInventoryLine
        {
            Id = Guid.NewGuid(),
            PropertyId = property.Id,
            StructureKind = "wall",
            Label = "سور",
        });
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(property, "yes"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("no")]
    public void A_non_land_asset_needs_the_table_whatever_the_land_answer_says(string? answer)
    {
        Assert.True(SpecialistComponentsRules.HasStructures(Property(inspectedType: "عمارة"), answer));
    }

    [Theory]
    [InlineData("""{"landHasValuableStructures":"yes"}""", "yes")]
    [InlineData("""{"landHasValuableStructures":" No "}""", "no")]
    [InlineData("""{"landHasValuableStructures":""}""", null)]
    [InlineData("""{"landHasValuableStructures":"maybe"}""", null)]
    [InlineData("""{"landHasValuableStructures":true}""", null)]
    [InlineData("{}", null)]
    [InlineData("not json", null)]
    [InlineData(null, null)]
    public void The_land_answer_is_read_from_the_payload_root(string? payload, string? expected)
    {
        Assert.Equal(expected, SpecialistComponentsRules.ReadLandHasValuableStructures(payload));
    }

    [Fact]
    public void An_intake_land_type_is_not_a_land_declaration()
    {
        // The inspector never answered the asset type: the intake «أرض» alone does not exempt.
        var property = Property("أرض بها غرفة حارس", lines: 0, propertyType: "أرض", inspectedType: null);

        Assert.True(SpecialistComponentsRules.HasStructures(property));
        Assert.Equal(SpecialistComponentsRules.InventoryRequired,
            SpecialistComponentsRules.MissingForAcceptance(property)["inventoryLines"]);
    }

    [Fact]
    public void A_property_with_no_declaration_and_no_type_counts_as_having_structures()
    {
        Assert.True(SpecialistComponentsRules.HasStructures(Property()));
    }

    [Fact]
    public void A_plot_whose_inspector_declared_a_building_needs_the_table_whatever_the_intake_said()
    {
        var property = Property("فيلا", propertyType: "أرض", inspectedType: "فيلا");

        Assert.True(SpecialistComponentsRules.HasStructures(property));
        Assert.False(SpecialistComponentsRules.IsInspectedLand(property));
    }

    [Fact]
    public void A_listed_annex_on_a_declared_plot_is_still_accepted()
    {
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(
            Property("أرض وغرفة حارس", lines: 1, inspectedType: "أرض")));
    }
}
