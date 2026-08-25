using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ValuationComparableSelectionRulesTests
{
    [Fact]
    public void MeetsMinimumAdopted_false_when_empty()
    {
        Assert.False(ValuationComparableSelectionRules.MeetsMinimumAdopted(
            Array.Empty<ValuationComparableSelection>()));
    }

    [Fact]
    public void MeetsMinimumAdopted_requires_two_adopted_flags()
    {
        var rows = new[]
        {
            new ValuationComparableSelection { IsAdopted = false },
            new ValuationComparableSelection { IsAdopted = false },
        };
        Assert.False(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));

        rows[1].IsAdopted = true;
        Assert.False(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));
        rows[0].IsAdopted = true;
        Assert.True(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));
    }

    [Theory]
    [InlineData(new[] { false, false }, false)]
    [InlineData(new[] { true }, false)]
    [InlineData(new[] { false, true, false }, false)]
    [InlineData(new[] { true, true }, true)]
    public void MeetsMinimumAdopted_flags(bool[] flags, bool expected)
    {
        Assert.Equal(expected, ValuationComparableSelectionRules.MeetsMinimumAdopted(flags));
    }
}
