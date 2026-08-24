using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class PropertyComparableLinkRulesTests
{
    [Theory]
    [InlineData(0, false)]
    [InlineData(1, false)]
    [InlineData(2, true)]
    [InlineData(5, true)]
    public void MeetsMinimum_requires_two(int count, bool expected)
    {
        Assert.Equal(expected, PropertyComparableLinkRules.MeetsMinimum(count));
        Assert.Equal(2, PropertyComparableLinkRules.MinimumLinkedForAppraisalPrep);
    }
}
