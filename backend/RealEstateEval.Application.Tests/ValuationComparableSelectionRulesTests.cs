using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ValuationComparableSelectionRulesTests
{
    [Fact]
    public void HasAtLeastOneAdopted_false_when_empty()
    {
        Assert.False(ValuationComparableSelectionRules.HasAtLeastOneAdopted(
            Array.Empty<ValuationComparableSelection>()));
    }

    [Fact]
    public void HasAtLeastOneAdopted_requires_adopted_flag()
    {
        var rows = new[]
        {
            new ValuationComparableSelection { IsAdopted = false },
            new ValuationComparableSelection { IsAdopted = false },
        };
        Assert.False(ValuationComparableSelectionRules.HasAtLeastOneAdopted(rows));

        rows[1].IsAdopted = true;
        Assert.True(ValuationComparableSelectionRules.HasAtLeastOneAdopted(rows));
    }

    [Theory]
    [InlineData(new[] { false, false }, false)]
    [InlineData(new[] { true }, true)]
    [InlineData(new[] { false, true, false }, true)]
    public void HasAtLeastOneAdopted_flags(bool[] flags, bool expected)
    {
        Assert.Equal(expected, ValuationComparableSelectionRules.HasAtLeastOneAdopted(flags));
    }
}
