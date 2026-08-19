using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class AssignmentValuationDefaultsTests
{
    [Theory]
    [InlineData(AssignmentType.Execution, "auction_liquidation", "البيع بالمزاد العلني لغرض التصفية")]
    [InlineData(AssignmentType.Estates, "auction_liquidation", "البيع بالمزاد العلني لغرض التصفية")]
    [InlineData(AssignmentType.PrivateSector, "sale", "البيع")]
    public void Purpose_follows_assignment_primary(
        AssignmentType type,
        string key,
        string label)
    {
        Assert.Equal(key, AssignmentValuationDefaults.PurposeKey(type));
        Assert.Equal(label, AssignmentValuationDefaults.PurposeLabelAr(type));
    }

    [Theory]
    [InlineData(AssignmentType.Execution, "liquidation", "قيمة التصفية")]
    [InlineData(AssignmentType.Estates, "liquidation", "قيمة التصفية")]
    [InlineData(AssignmentType.PrivateSector, "market", "القيمة السوقية")]
    public void Basis_follows_assignment_primary(
        AssignmentType type,
        string key,
        string label)
    {
        Assert.Equal(key, AssignmentValuationDefaults.BasisOfValueKey(type));
        Assert.Equal(label, AssignmentValuationDefaults.BasisOfValueLabelAr(type));
    }
}
