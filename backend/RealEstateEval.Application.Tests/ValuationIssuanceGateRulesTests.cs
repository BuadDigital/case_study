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
            ValuationIssuanceGateRules.MinAdoptedComparables(2),
            ValuationIssuanceGateRules.ComparableWeights(true, 2),
            ValuationIssuanceGateRules.ReconciliationWeights(true, true),
            ValuationIssuanceGateRules.FinalOpinion(500_000m),
        };
        Assert.True(ValuationIssuanceGateRules.AllowsIssuance(checks));
    }

    [Fact]
    public void Study_report_gate_is_hard_and_blocks_only_a_report_known_not_to_be_issued()
    {
        var missing = ValuationIssuanceGateRules.StudyReportIssued(false);
        Assert.Equal("study_report_issued", missing.Code);
        Assert.Equal(ValuationIssuanceGateCodes.StudyReportIssued, missing.Code);
        Assert.True(missing.IsHard);
        Assert.False(missing.Passed);
        Assert.NotNull(missing.DetailAr);
        Assert.False(ValuationIssuanceGateRules.AllowsIssuance([missing]));

        var issued = ValuationIssuanceGateRules.StudyReportIssued(true);
        Assert.True(issued.Passed);
        Assert.Null(issued.DetailAr);
        Assert.True(ValuationIssuanceGateRules.AllowsIssuance([issued]));

        // 2026-11-10: «unknown» (Case Study unreachable / empty answer) blocks with «تعذّر التحقق»; only a
        // valuation with no case-study property at all (legacy) passes.
        var unknown = ValuationIssuanceGateRules.StudyReportIssued(null);
        Assert.False(unknown.Passed);
        Assert.Equal(ValuationIssuanceGateRules.CaseStudyStateUnavailableAr, unknown.DetailAr);
        Assert.True(ValuationIssuanceGateRules.StudyReportIssued(null, linkedToCaseStudy: false).Passed);
    }

    [Fact]
    public void Cost_depreciation_gate_blocks_only_an_enabled_cost_approach_with_a_missing_age()
    {
        var blocked = ValuationIssuanceGateRules.CostDepreciationComplete(costApproachEnabled: true, depreciationIncomplete: true);
        Assert.Equal(ValuationIssuanceGateCodes.CostDepreciationComplete, blocked.Code);
        Assert.True(blocked.IsHard);
        Assert.False(blocked.Passed);
        Assert.Equal("أدخل العمر الفعلي والعمر الاقتصادي للمباني في أسلوب التكلفة", blocked.DetailAr);

        Assert.True(ValuationIssuanceGateRules.CostDepreciationComplete(true, false).Passed);
        Assert.True(ValuationIssuanceGateRules.CostDepreciationComplete(false, true).Passed);
    }

    [Fact]
    public void Reconciliation_gate_names_the_missing_saved_rationale()
    {
        var unsaved = ValuationIssuanceGateRules.ReconciliationWeights(hasReconciliation: false, weightsSumTo100: true);
        Assert.False(unsaved.Passed);
        Assert.Equal(ValuationIssuanceGateRules.ReconciliationNotSavedAr, unsaved.DetailAr);
    }

    [Fact]
    public void Participant_with_an_unreadable_date_is_named_and_blocks()
    {
        var check = ValuationIssuanceGateRules.ParticipantCredentials(
            [new ValuationIssuanceGateRules.RosterParticipantCredentials("سالم", "N/A", "2027-06-01")],
            Today);
        Assert.False(check.Passed);
        Assert.Contains("سالم: " + ValuerCredentialRules.LicenseDateUnreadableAr, check.DetailAr);
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

    [Fact]
    public void Required_attachments_are_also_looked_up_under_the_survey_task()
    {
        var task = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        Assert.Equal(
            ["prop-1", "PO-9:prop-1", task.ToString("D")],
            ValuationIssuanceGateRules.AttachmentScopeKeys("prop-1", " PO-9 ", [task, task, Guid.Empty]));
        Assert.Equal(["prop-1"], ValuationIssuanceGateRules.AttachmentScopeKeys("prop-1", null, []));
    }
}
