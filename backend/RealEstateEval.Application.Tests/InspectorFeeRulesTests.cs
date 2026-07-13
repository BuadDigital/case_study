using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class InspectorFeeRulesTests
{
    [Theory]
    [InlineData("fi-ahmed", "متعاون فرد", 400)]
    [InlineData("fi-abdullah-abdulmane", "موظف", 100)]
    [InlineData(null, "موظف", 100)]
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
    public void Engineering_office_is_always_external_at_500(string? assigneeId)
    {
        Assert.Equal(
            InspectorFeeRules.TypeCooperatorOrganization,
            EngineeringSurveyFeeRules.ResolveOfficeType(assigneeId));
        Assert.Equal(500m, EngineeringSurveyFeeRules.DefaultAgreedFee());
        Assert.Equal(500m, EngineeringSurveyFeeRules.FallbackFeeSar);
        Assert.Equal(500m, EngineeringSurveyFeeRules.DefaultAgreedFee("موظف"));
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
    }

    [Fact]
    public void Net_fee_never_goes_negative()
    {
        Assert.Equal(350m, InspectorFeeRules.NetFee(400m, 50m));
        Assert.Equal(0m, InspectorFeeRules.NetFee(100m, 200m));
        Assert.Equal(350m, EngineeringSurveyFeeRules.NetFee(500m, 150m));
    }
}
