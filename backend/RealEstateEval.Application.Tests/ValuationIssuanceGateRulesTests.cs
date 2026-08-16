using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ValuationIssuanceGateRulesTests
{
    private static readonly DateOnly Today = new(2026, 8, 16);

    [Fact]
    public void AllowsIssuance_when_all_hard_gates_pass()
    {
        var checks = new[]
        {
            ValuationIssuanceGateRules.Credentials("2027-01-01", "2027-06-01", Today),
            ValuationIssuanceGateRules.DeedNatureMatch(DeedKind.RegisteredTitle, ""),
            ValuationIssuanceGateRules.MinAdoptedComparables(1),
            ValuationIssuanceGateRules.ComparableWeights(true, 1),
            ValuationIssuanceGateRules.ReconciliationWeights(true, true),
            ValuationIssuanceGateRules.FinalOpinion(500_000m),
        };
        Assert.True(ValuationIssuanceGateRules.AllowsIssuance(checks));
    }

    [Fact]
    public void Blocks_when_credentials_expired()
    {
        var check = ValuationIssuanceGateRules.Credentials("2020-01-01", "2027-01-01", Today);
        Assert.False(check.Passed);
        Assert.False(ValuationIssuanceGateRules.AllowsIssuance([check]));
    }

    [Fact]
    public void Blocks_traditional_without_match()
    {
        var check = ValuationIssuanceGateRules.DeedNatureMatch(
            DeedKind.Traditional,
            DeedNatureMatchOutcomes.Differences);
        Assert.False(check.Passed);
    }

    [Fact]
    public void Blocks_missing_final_opinion()
    {
        Assert.False(ValuationIssuanceGateRules.FinalOpinion(0m).Passed);
    }
}
