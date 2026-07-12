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
    [InlineData("jeddah_survey", "متعاون شركة", 500)]
    [InlineData("eo-jeddah", "متعاون شركة", 500)]
    [InlineData("eo-internal", "موظف", 150)]
    public void Resolves_engineering_office_type_and_default_fee(
        string? assigneeId,
        string expectedType,
        decimal expectedFee)
    {
        var type = EngineeringSurveyFeeRules.ResolveOfficeType(assigneeId);
        Assert.Equal(expectedType, type);
        Assert.Equal(expectedFee, EngineeringSurveyFeeRules.DefaultAgreedFee(type));
    }

    [Theory]
    [InlineData("متعاون فرد", 350)]
    [InlineData("متعاون شركة", 450)]
    [InlineData("متعاون", 350)]
    [InlineData("موظف", 100)]
    public void Resolves_government_review_default_fee(
        string partyType,
        decimal expectedFee)
    {
        Assert.Equal(expectedFee, GovernmentReviewFeeRules.DefaultAgreedFee(partyType));
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
