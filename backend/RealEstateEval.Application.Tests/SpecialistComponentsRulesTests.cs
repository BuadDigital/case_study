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

    [Theory]
    [InlineData("فيلا")]
    [InlineData("عمارة")]
    [InlineData("أرض")]
    [InlineData(null)]
    public void An_empty_inventory_table_never_blocks_acceptance(string? inspectedType)
    {
        // Decision 2026-10-15: the table is not a condition for any asset type.
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(
            Property("وصف المكونات", lines: 0, inspectedType: inspectedType)));
    }

    [Fact]
    public void Only_the_text_is_reported_when_both_are_empty()
    {
        var missing = SpecialistComponentsRules.MissingForAcceptance(Property(text: "  ", inspectedType: "عمارة"));

        Assert.Equal(SpecialistComponentsRules.TextRequired, missing["componentsText"]);
        Assert.Single(missing);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no")]
    public void A_land_without_a_yes_answer_needs_the_text_only(string? answer)
    {
        // «no» (annexes irrelevant to valuation), unanswered, and legacy land submissions are all exempt.
        var missing = SpecialistComponentsRules.MissingForAcceptance(
            Property(text: null, lines: 0, inspectedType: "أرض"));
        Assert.Equal(["componentsText"], missing.Keys);

        var property = Property("أرض فضاء", lines: 0, inspectedType: "أرض");
        Assert.False(SpecialistComponentsRules.HasStructures(property, answer));
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(property));
    }

    [Fact]
    public void A_land_with_valuable_structures_lists_the_table_but_is_accepted_without_it()
    {
        var property = Property("أرض وسور وغرفة حارس", lines: 0, inspectedType: "أرض");

        Assert.True(SpecialistComponentsRules.IsInspectedLand(property));
        Assert.True(SpecialistComponentsRules.HasStructures(property, "yes"));
        Assert.Empty(SpecialistComponentsRules.MissingForAcceptance(property));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("no")]
    public void A_non_land_asset_lists_the_table_whatever_the_land_answer_says(string? answer)
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
        // The inspector never answered the asset type: the intake «أرض» alone does not make it land.
        var property = Property("أرض بها غرفة حارس", lines: 0, propertyType: "أرض", inspectedType: null);

        Assert.True(SpecialistComponentsRules.HasStructures(property));
        Assert.False(SpecialistComponentsRules.IsInspectedLand(property));
    }

    [Fact]
    public void A_property_with_no_declaration_and_no_type_counts_as_having_structures()
    {
        Assert.True(SpecialistComponentsRules.HasStructures(Property()));
    }

    [Fact]
    public void A_plot_whose_inspector_declared_a_building_lists_the_table_whatever_the_intake_said()
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
