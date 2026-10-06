using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class InspectorDataGroupRulesTests
{
    private const string Appraiser = "property-appraisal";
    private const string Office = "engineering-survey";

    [Fact]
    public void The_map_covers_exactly_the_digest_groups_in_the_same_order()
    {
        Assert.Equal(
            InspectorDataDigestRules.GroupKeys,
            InspectorDataGroupRules.All.Select(g => g.Key).ToList());
        Assert.All(InspectorDataGroupRules.All, g => Assert.False(string.IsNullOrWhiteSpace(g.LabelAr)));
    }

    [Theory]
    [InlineData("assetType", new[] { Appraiser })]
    [InlineData("components", new[] { Appraiser })]
    [InlineData("area", new[] { Appraiser, Office })]
    [InlineData("age", new[] { Appraiser })]
    [InlineData("boundaries", new[] { Office })]
    [InlineData("location", new[] { Office, Appraiser })]
    [InlineData("photos", new[] { Appraiser })]
    [InlineData("narrative", new[] { Appraiser })]
    [InlineData("services", new[] { Appraiser })]
    public void Each_section_suggests_its_fixed_parties(string key, string[] expected)
    {
        var group = InspectorDataGroupRules.Find(key);

        Assert.NotNull(group);
        Assert.Equal(expected.OrderBy(x => x), group!.SuggestedKinds.OrderBy(x => x));
    }

    [Fact]
    public void Resolve_keeps_the_map_order_dedupes_trims_and_reports_unknown_keys()
    {
        var groups = InspectorDataGroupRules.Resolve(
            [" photos ", "area", "photos", "", "bogus"],
            out var unknown);

        Assert.Equal(["area", "photos"], groups.Select(g => g.Key).ToList());
        Assert.Equal(["bogus"], unknown);
    }

    [Fact]
    public void Resolve_of_nothing_is_empty()
    {
        Assert.Empty(InspectorDataGroupRules.Resolve(null, out var unknown));
        Assert.Empty(unknown);
    }

    [Fact]
    public void Suggested_because_lists_the_labels_of_the_requested_sections_that_suggest_the_party()
    {
        var groups = InspectorDataGroupRules.Resolve(["components", "area", "boundaries"], out _);

        var appraiser = InspectorDataGroupRules.SuggestedBecause(Appraiser, groups);
        var office = InspectorDataGroupRules.SuggestedBecause(Office, groups);

        Assert.Equal(
            [InspectorDataGroupRules.Find("components")!.LabelAr, InspectorDataGroupRules.Find("area")!.LabelAr],
            appraiser);
        Assert.Equal(
            [InspectorDataGroupRules.Find("area")!.LabelAr, InspectorDataGroupRules.Find("boundaries")!.LabelAr],
            office);
        Assert.Empty(InspectorDataGroupRules.SuggestedBecause(Appraiser, []));
    }
}
