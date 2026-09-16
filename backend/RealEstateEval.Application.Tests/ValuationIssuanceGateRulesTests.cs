using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.Valuation.Domain;

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
            ValuationIssuanceGateRules.ParticipantCredentials(
                [
                    new ValuationIssuanceGateRules.RosterParticipantCredentials(
                        "مساعد",
                        "2027-01-01",
                        "2027-06-01"),
                ],
                Today),
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
    public void Participant_credentials_pass_when_roster_empty()
    {
        var check = ValuationIssuanceGateRules.ParticipantCredentials([], Today);
        Assert.True(check.Passed);
    }

    [Fact]
    public void Blocks_when_participant_membership_expired()
    {
        var check = ValuationIssuanceGateRules.ParticipantCredentials(
            [
                new ValuationIssuanceGateRules.RosterParticipantCredentials(
                    "مساعد أحمد",
                    "2027-01-01",
                    "2026-01-01"),
            ],
            Today);
        Assert.False(check.Passed);
        Assert.Contains("مساعد أحمد", check.DetailAr);
        Assert.Contains("العضوية", check.DetailAr);
        Assert.False(ValuationIssuanceGateRules.AllowsIssuance([check]));
    }

    [Fact]
    public void Blocks_when_participant_membership_date_missing()
    {
        var check = ValuationIssuanceGateRules.ParticipantCredentials(
            [
                new ValuationIssuanceGateRules.RosterParticipantCredentials(
                    "مراجع",
                    "2027-01-01",
                    null),
            ],
            Today);
        Assert.False(check.Passed);
        Assert.Contains("العضوية", check.DetailAr);
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

    [Fact]
    public void Min_adopted_comparables_pass_when_approach_is_off()
    {
        var marketOff = ValuationIssuanceGateRules.MinAdoptedComparablesForApproach(
            "market",
            "مقارنات أسلوب السوق",
            approachEnabled: false,
            adoptedCount: 0);
        Assert.True(marketOff.Passed);
        Assert.Null(marketOff.DetailAr);

        var landWithinCostOff = ValuationIssuanceGateRules.MinAdoptedComparablesForApproach(
            "land_within_cost",
            "مقارنات الأرض ضمن التكلفة",
            approachEnabled: false,
            adoptedCount: 0);
        Assert.True(landWithinCostOff.Passed);
    }

    [Fact]
    public void Required_attachments_drop_survey_when_the_property_does_not_need_one()
    {
        var types = new[] { "deed", "survey", "zoning-sketch" };
        var stillRequired = ValuationIssuanceGateRules.RequiredAttachmentsForProperty(
            types,
            key => key,
            propertyRequiresSurvey: true);
        Assert.Equal(types, stillRequired);

        var withoutSurvey = ValuationIssuanceGateRules.RequiredAttachmentsForProperty(
            types,
            key => key,
            propertyRequiresSurvey: false);
        Assert.Equal(["deed", "zoning-sketch"], withoutSurvey);
    }
}
