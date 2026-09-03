using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ComparablePropertyRulesTests
{
    [Fact]
    public void ComputePricePerSqm_rounds_away_from_zero()
    {
        Assert.Equal(123.46m, ComparablePropertyRules.ComputePricePerSqm(1234.56m, 10m));
    }

    [Fact]
    public void ComputePricePerSqm_zero_area()
    {
        Assert.Equal(0m, ComparablePropertyRules.ComputePricePerSqm(100m, 0m));
    }

    [Theory]
    [InlineData("offer", true)]
    [InlineData("executed", true)]
    [InlineData("deal", false)]
    public void TransactionKind_known(string kind, bool known)
    {
        Assert.Equal(known, ComparableTransactionKinds.IsKnown(kind));
    }

    [Fact]
    public void Freshness_recent_within_window()
    {
        var today = new DateOnly(2026, 8, 16);
        Assert.Equal("recent", ComparablePropertyRules.FreshnessKey(new DateOnly(2026, 7, 1), today));
        Assert.Equal("stored", ComparablePropertyRules.FreshnessKey(new DateOnly(2025, 1, 1), today));
    }
}
