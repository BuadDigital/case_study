using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class InspectorFeeRulesTests
{
    [Theory]
    [InlineData("fi-ahmed", "متعاون", 400)]
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

    [Fact]
    public void Net_fee_never_goes_negative()
    {
        Assert.Equal(350m, InspectorFeeRules.NetFee(400m, 50m));
        Assert.Equal(0m, InspectorFeeRules.NetFee(100m, 200m));
    }
}
