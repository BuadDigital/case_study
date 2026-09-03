using RealEstateEval.CaseStudy.Domain;
using static RealEstateEval.CaseStudy.Domain.TransactionStateRules;

namespace RealEstateEval.Application.Tests;

/// <summary>Q-9: Transaction State Machine — Distribution and Dependencies Network, Inspector Key Node.</summary>
public class TransactionStateRulesTests
{
    private static Input BaseInput(
        string phase = "case_study",
        PartyFacts? inspector = null,
        PartyFacts? appraiser = null,
        PartyFacts? office = null,
        PartyFacts? specialist = null,
        bool officeRequired = true,
        bool valuationClosed = false,
        bool handedOver = false) =>
        new(
            ParentPhase: phase,
            Inspector: inspector ?? new PartyFacts(Assigned: true, Completed: false),
            Appraiser: appraiser ?? new PartyFacts(Assigned: true, Completed: false),
            EngineeringOffice: officeRequired
                ? office ?? new PartyFacts(Assigned: true, Completed: false)
                : null,
            CaseSpecialist: specialist ?? new PartyFacts(Assigned: true, Completed: false),
            ValuationReportClosed: valuationClosed,
            EnfazHandedOver: handedOver);

    [Fact]
    public void Foundational_stages_follow_the_parent_phase_sequence()
    {
        var atEnfath = Evaluate(BaseInput(phase: "enfath"));
        Assert.Equal(Statuses.InProgress,
            atEnfath.Stages.First(s => s.Key == Stages.InitialData).Status);
        Assert.Equal(Statuses.NotStarted,
            atEnfath.Stages.First(s => s.Key == Stages.BourseInquiry).Status);
        Assert.Equal(Statuses.NotStarted,
            atEnfath.Stages.First(s => s.Key == Stages.PartyWork).Status);

        var atBourse = Evaluate(BaseInput(phase: "bourse"));
        Assert.Equal(Statuses.Completed,
            atBourse.Stages.First(s => s.Key == Stages.InitialData).Status);
        Assert.Equal(Statuses.InProgress,
            atBourse.Stages.First(s => s.Key == Stages.BourseInquiry).Status);

        var atDistribution = Evaluate(BaseInput(phase: "distribution"));
        Assert.Equal(Statuses.InProgress,
            atDistribution.Stages.First(s => s.Key == Stages.Distribution).Status);
    }

    [Fact]
    public void Inspector_is_the_key_node_everyone_waits_for()
    {
        var result = Evaluate(BaseInput());

        var inspector = result.Parties.Single(p => p.Key == Parties.Inspector);
        Assert.Equal(Statuses.InProgress, inspector.Status);
        Assert.Empty(inspector.WaitingOn);

        // Engineering Office and Appraiser are waiting for Inspector.
        foreach (var key in new[] { Parties.EngineeringOffice, Parties.Appraiser })
        {
            var party = result.Parties.Single(p => p.Key == key);
            Assert.Equal(Statuses.WaitingOnParty, party.Status);
            Assert.Equal([Parties.Inspector], party.WaitingOn);
        }

        // Case Study Specialist is waiting for everyone.
        var specialist = result.Parties.Single(p => p.Key == Parties.CaseSpecialist);
        Assert.Equal(Statuses.WaitingOnParty, specialist.Status);
        Assert.Equal(
            [Parties.Inspector, Parties.Appraiser, Parties.EngineeringOffice],
            specialist.WaitingOn);

        Assert.Contains("المعاين", result.WaitingSummaryAr);
        Assert.Equal(Statuses.WaitingOnParty, result.OverallStatus);
    }

    [Fact]
    public void Inspector_completion_releases_office_and_appraiser()
    {
        var result = Evaluate(BaseInput(
            inspector: new PartyFacts(Assigned: true, Completed: true)));

        Assert.Equal(Statuses.InProgress,
            result.Parties.Single(p => p.Key == Parties.EngineeringOffice).Status);
        Assert.Equal(Statuses.InProgress,
            result.Parties.Single(p => p.Key == Parties.Appraiser).Status);
        // The specialist is still waiting for Appraiser and the office.
        Assert.Equal(
            [Parties.Appraiser, Parties.EngineeringOffice],
            result.Parties.Single(p => p.Key == Parties.CaseSpecialist).WaitingOn);
    }

    [Fact]
    public void Transaction_without_survey_has_no_engineering_office_party()
    {
        var result = Evaluate(BaseInput(officeRequired: false));
        Assert.DoesNotContain(result.Parties, p => p.Key == Parties.EngineeringOffice);
        Assert.Equal(
            [Parties.Inspector, Parties.Appraiser],
            result.Parties.Single(p => p.Key == Parties.CaseSpecialist).WaitingOn);
        Assert.Equal(3, HandoverPackageAr(hasSurvey: false).Count);
        Assert.DoesNotContain(
            HandoverPackageAr(hasSurvey: false),
            item => item.Contains("المساحي"));
    }

    [Fact]
    public void Closing_is_two_steps_deposit_certificate_then_enfaz_handover()
    {
        var allDone = BaseInput(
            inspector: new PartyFacts(true, true),
            appraiser: new PartyFacts(true, true),
            office: new PartyFacts(true, true),
            specialist: new PartyFacts(true, true));

        // Without a Deposit Certificate: the closing is pending and may not be lifted.
        var beforeDeposit = Evaluate(allDone);
        Assert.Equal(Statuses.InProgress,
            beforeDeposit.Stages.First(s => s.Key == Stages.DepositCertificate).Status);
        Assert.Equal(Statuses.WaitingOnParty,
            beforeDeposit.Stages.First(s => s.Key == Stages.EnfazHandover).Status);
        Assert.False(AllowsEnfazHandover(allDone));

        // Deposit Certificate issued: Upload ready.
        var withDeposit = allDone with { ValuationReportClosed = true };
        var readyState = Evaluate(withDeposit);
        Assert.Equal(Statuses.Completed,
            readyState.Stages.First(s => s.Key == Stages.DepositCertificate).Status);
        Assert.Equal(Statuses.InProgress,
            readyState.Stages.First(s => s.Key == Stages.EnfazHandover).Status);
        Assert.True(AllowsEnfazHandover(withDeposit));

        // After uploading: The transaction is complete.
        var handedOver = withDeposit with { EnfazHandedOver = true };
        var final = Evaluate(handedOver);
        Assert.Equal(Statuses.Completed, final.OverallStatus);
        Assert.Equal(Statuses.Completed,
            final.Stages.First(s => s.Key == Stages.EnfazHandover).Status);
        Assert.False(AllowsEnfazHandover(handedOver));
        Assert.Contains("إنفاذ", final.WaitingSummaryAr);
    }

    [Fact]
    public void Deposit_certificate_alone_does_not_allow_handover_before_parties_finish()
    {
        // Deposit Certificate issued but the specialist did not complete — mass uploading prohibited.
        var input = BaseInput(
            inspector: new PartyFacts(true, true),
            appraiser: new PartyFacts(true, true),
            office: new PartyFacts(true, true),
            specialist: new PartyFacts(true, false),
            valuationClosed: true);
        Assert.False(AllowsEnfazHandover(input));
        Assert.Equal(Statuses.WaitingOnParty,
            Evaluate(input).Stages.First(s => s.Key == Stages.EnfazHandover).Status);
    }

    [Fact]
    public void Handover_package_lists_the_comprehensive_delivery()
    {
        var withSurvey = HandoverPackageAr(hasSurvey: true);
        Assert.Contains(withSurvey, i => i.Contains("النسخة النهائية"));
        Assert.Contains(withSurvey, i => i.Contains("دراسة الحالة"));
        Assert.Contains(withSurvey, i => i.Contains("المساحي"));
    }

    [Fact]
    public void Fresh_transaction_before_distribution_is_not_started()
    {
        var result = Evaluate(BaseInput(
            phase: "enfath",
            inspector: new PartyFacts(false, false),
            appraiser: new PartyFacts(false, false),
            office: new PartyFacts(false, false),
            specialist: new PartyFacts(false, false)));
        Assert.All(
            result.Parties,
            p => Assert.Equal(Statuses.NotStarted, p.Status));
        Assert.Equal(Statuses.NotStarted, result.OverallStatus);
    }
}
