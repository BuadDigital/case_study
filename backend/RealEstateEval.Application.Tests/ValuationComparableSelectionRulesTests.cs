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
    public void MeetsMinimumAdopted_requires_one_adopted_per_logic_doc()
    {
        var rows = new[]
        {
            new ValuationComparableSelection { IsAdopted = false },
            new ValuationComparableSelection { IsAdopted = false },
        };
        Assert.False(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));

        rows[1].IsAdopted = true;
        Assert.True(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));
    }

    [Theory]
    [InlineData(new[] { false, false }, false)]
    [InlineData(new[] { true }, true)]
    [InlineData(new[] { false, true, false }, true)]
    [InlineData(new[] { true, true }, true)]
    public void MeetsMinimumAdopted_flags(bool[] flags, bool expected)
    {
        Assert.Equal(expected, ValuationComparableSelectionRules.MeetsMinimumAdopted(flags));
    }
}
