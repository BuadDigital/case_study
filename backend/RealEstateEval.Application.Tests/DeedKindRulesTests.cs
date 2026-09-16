using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class DeedKindRulesTests
{
    [Fact]
    public void RegisteredTitle_skips_match_gate_and_allows_calc()
    {
        Assert.True(DeedKindRules.SkipsSurveyMatchGate(DeedKind.RegisteredTitle));
        Assert.False(DeedKindRules.RequiresDeedNatureMatchGate(DeedKind.RegisteredTitle));
        Assert.True(DeedKindRules.AllowsValuationCalc(DeedKind.RegisteredTitle, DeedNatureMatchOutcomes.Unset));
    }

    [Theory]
    [InlineData(DeedNatureMatchOutcomes.Unset, false)]
    [InlineData(DeedNatureMatchOutcomes.Differences, false)]
    [InlineData(DeedNatureMatchOutcomes.Impediment, false)]
    [InlineData(DeedNatureMatchOutcomes.Matched, true)]
    public void Traditional_requires_matched_outcome(string outcome, bool allowed)
    {
        Assert.True(DeedKindRules.RequiresDeedNatureMatchGate(DeedKind.Traditional));
        Assert.Equal(allowed, DeedKindRules.AllowsValuationCalc(DeedKind.Traditional, outcome));
        Assert.Equal(allowed, DeedKindRules.AllowsCaseStudyReport(DeedKind.Traditional, outcome));
    }

    [Fact]
    public void SuggestFromIdentifier_maps_real_estate_reg()
    {
        Assert.Equal(
            DeedKind.RegisteredTitle,
            DeedKindLabels.SuggestFromIdentifier(PropertyIdentifierType.RealEstateRegistration));
        Assert.Equal(
            DeedKind.Traditional,
            DeedKindLabels.SuggestFromIdentifier(PropertyIdentifierType.Deed));
    }

    [Theory]
    [InlineData("registered_title")]
    [InlineData("registered")]
    [InlineData("RegisteredTitle")]
    [InlineData("سجل عيني")]
    public void TryParseApiValue_accepts_registered_title_aliases(string value)
    {
        Assert.True(DeedKindLabels.TryParseApiValue(value, out var kind));
        Assert.Equal(DeedKind.RegisteredTitle, kind);
    }
}
