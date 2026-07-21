using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class InspectorFeeRulesTests
{
    [Theory]
    [InlineData("fi-ahmed", "متعاون فرد", 400)]
    [InlineData("fi-abdullah-abdulmane", "موظف", 0)]
    [InlineData(null, "موظف", 0)]
    public void Resolves_inspector_type_and_default_fee(
        string? assigneeId,
        string expectedType,
        decimal expectedFee)
    {
        var type = InspectorFeeRules.ResolveInspectorType(assigneeId);
        Assert.Equal(expectedType, type);
        Assert.Equal(expectedFee, InspectorFeeRules.DefaultAgreedFee(type));
    }

    [Theory]
    [InlineData("jeddah_survey")]
    [InlineData("eo-jeddah")]
    [InlineData("eo-internal")]
    [InlineData(null)]
    public void Engineering_office_is_always_external(string? assigneeId)
    {
        Assert.Equal(
            InspectorFeeRules.TypeCooperatorOrganization,
            EngineeringSurveyFeeRules.ResolveOfficeType(assigneeId));
    }

    [Theory]
    [InlineData(100, 300)]
    [InlineData(500, 300)]
    [InlineData(501, 450)]
    [InlineData(1000, 450)]
    [InlineData(1001, 900)]
    [InlineData(1500, 900)]
    [InlineData(1501, 1500)]
    [InlineData(10000, 1500)]
    [InlineData(10001, 4000)]
    public void Engineering_survey_area_tiers(decimal areaM2, decimal expectedFee)
    {
        var fee = EngineeringSurveyFeeRules.ResolveFeeFromTiers(
            areaM2,
            [
                new(500m, 300m),
                new(1000m, 450m),
                new(1500m, 900m),
                new(10000m, 1500m),
                new(null, 4000m),
            ]);
        Assert.Equal(expectedFee, fee);
    }

    [Fact]
    public void Normalizes_non_increasing_tier_maxes()
    {
        var tiers = EngineeringSurveyFeeRules.NormalizeTiers(
        [
            new(800m, 100m),
            new(500m, 200m),
            new(500m, 300m),
            new(2000m, 400m),
            new(null, 500m),
        ]);
        Assert.Equal(5, tiers.Count);
        Assert.Equal(800m, tiers[0].MaxAreaM2);
        Assert.Equal(801m, tiers[1].MaxAreaM2);
        Assert.Equal(802m, tiers[2].MaxAreaM2);
        Assert.Equal(2000m, tiers[3].MaxAreaM2);
        Assert.Null(tiers[4].MaxAreaM2);
    }

    [Fact]
    public void Supports_two_tier_schedule()
    {
        var fee = EngineeringSurveyFeeRules.ResolveFeeFromTiers(
            1200m,
            [
                new(1000m, 200m),
                new(null, 900m),
            ]);
        Assert.Equal(900m, fee);
    }

    [Theory]
    [InlineData("1200", true, 1200)]
    [InlineData("1,250.5", true, 1250.5)]
    [InlineData("", false, 0)]
    [InlineData("0", false, 0)]
    public void Parses_property_area(string raw, bool ok, decimal expected)
    {
        var parsed = EngineeringSurveyFeeRules.TryParseAreaM2(raw, out var area);
        Assert.Equal(ok, parsed);
        if (ok) Assert.Equal(expected, area);
    }

    [Theory]
    [InlineData("متعاون فرد")]
    [InlineData("متعاون شركة")]
    [InlineData("موظف")]
    [InlineData(null)]
    public void Government_review_is_always_individual_cooperator_at_350(string? partyType)
    {
        Assert.Equal(InspectorFeeRules.TypeCooperatorIndividual, GovernmentReviewFeeRules.PartyType);
        Assert.Equal(350m, GovernmentReviewFeeRules.DefaultAgreedFee(partyType));
        Assert.Equal(350m, GovernmentReviewFeeRules.FallbackFeeSar);
        Assert.Equal(350m, GovernmentReviewFeeRules.DefaultAgreedFee());
    }

    [Fact]
    public void Legacy_cooperator_maps_to_individual_fee()
    {
        Assert.Equal(400m, InspectorFeeRules.DefaultAgreedFee("متعاون"));
        Assert.True(InspectorFeeRules.IsCooperator("متعاون"));
        Assert.True(InspectorFeeRules.IsCooperator("متعاون فرد"));
        Assert.True(InspectorFeeRules.IsCooperator("متعاون شركة"));
        Assert.False(InspectorFeeRules.IsEmployee("متعاون فرد"));
        Assert.False(InspectorFeeRules.HasBillableAgreedFee(0m));
        Assert.True(InspectorFeeRules.HasBillableAgreedFee(1m));
    }

    [Fact]
    public void Net_fee_never_goes_negative()
    {
        Assert.Equal(350m, InspectorFeeRules.NetFee(400m, 50m));
        Assert.Equal(0m, InspectorFeeRules.NetFee(100m, 200m));
        Assert.Equal(350m, EngineeringSurveyFeeRules.NetFee(500m, 150m));
    }
}
