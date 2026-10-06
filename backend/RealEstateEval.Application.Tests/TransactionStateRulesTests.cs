using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
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
        bool handedOver = false,
        bool studyIssued = false) =>
        new(
            ParentPhase: phase,
            Inspector: inspector ?? new PartyFacts(Assigned: true, Completed: false),
            Appraiser: appraiser ?? new PartyFacts(Assigned: true, Completed: false),
            EngineeringOffice: officeRequired
                ? office ?? new PartyFacts(Assigned: true, Completed: false)
                : null,
            CaseSpecialist: specialist ?? new PartyFacts(Assigned: true, Completed: false),
            ValuationReportClosed: valuationClosed,
            EnfazHandedOver: handedOver,
            StudyReportIssued: studyIssued);

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
    public void Inspector_is_the_key_node_the_office_and_specialist_wait_for()
    {
        var result = Evaluate(BaseInput());

        var inspector = result.Parties.Single(p => p.Key == Parties.Inspector);
        Assert.Equal(Statuses.InProgress, inspector.Status);
        Assert.Empty(inspector.WaitingOn);

        // The engineering office waits for the inspector.
        var office = result.Parties.Single(p => p.Key == Parties.EngineeringOffice);
        Assert.Equal(Statuses.WaitingOnParty, office.Status);
        Assert.Equal([Parties.Inspector], office.WaitingOn);

        // The case-study specialist waits for the field parties, NOT for the appraiser.
        var specialist = result.Parties.Single(p => p.Key == Parties.CaseSpecialist);
        Assert.Equal(Statuses.WaitingOnParty, specialist.Status);
        Assert.Equal([Parties.Inspector, Parties.EngineeringOffice], specialist.WaitingOn);

        Assert.Contains("المعاين", result.WaitingSummaryAr);
        Assert.Equal(Statuses.WaitingOnParty, result.OverallStatus);
    }

    [Fact]
    public void Appraiser_submission_waits_on_the_specialist_report_not_on_the_inspector()
    {
        var waiting = Evaluate(BaseInput());
        var appraiser = waiting.Parties.Single(p => p.Key == Parties.Appraiser);
        Assert.Equal(Statuses.WaitingOnParty, appraiser.Status);
        Assert.Equal([Parties.CaseSpecialist], appraiser.WaitingOn);

        // The inspector finishing does not release the appraiser's submission.
        var inspectorDone = Evaluate(BaseInput(inspector: new PartyFacts(true, true)));
        Assert.Equal(
            [Parties.CaseSpecialist],
            inspectorDone.Parties.Single(p => p.Key == Parties.Appraiser).WaitingOn);

        // The issued report does.
        var issued = Evaluate(BaseInput(studyIssued: true));
        var released = issued.Parties.Single(p => p.Key == Parties.Appraiser);
        Assert.Equal(Statuses.InProgress, released.Status);
        Assert.Empty(released.WaitingOn);
    }

    [Fact]
    public void The_wait_is_not_circular_the_specialist_never_waits_on_the_appraiser()
    {
        var result = Evaluate(BaseInput(inspector: new PartyFacts(true, true), office: new PartyFacts(true, true)));

        var specialist = result.Parties.Single(p => p.Key == Parties.CaseSpecialist);
        Assert.DoesNotContain(Parties.Appraiser, specialist.WaitingOn);
        // With the field parties done the specialist is free to issue, while the appraiser still waits on it.
        Assert.Equal(Statuses.InProgress, specialist.Status);
        Assert.Equal(
            [Parties.CaseSpecialist],
            result.Parties.Single(p => p.Key == Parties.Appraiser).WaitingOn);
    }

    [Fact]
    public void A_completed_case_study_task_counts_as_the_report_issued()
    {
        // Parent completes only by issuing the report — an input that omits the flag still releases the appraiser.
        var result = Evaluate(BaseInput(specialist: new PartyFacts(true, true)));
        Assert.Empty(result.Parties.Single(p => p.Key == Parties.Appraiser).WaitingOn);
    }

    [Fact]
    public void Post_enfaz_decision_accepts_the_prototype_role_not_the_jwt_editor_role()
    {
        Assert.True(AllowsPostEnfazDecision(StaffRoleIds.GeneralManager));
        Assert.False(AllowsPostEnfazDecision("Editor"));
        Assert.False(AllowsPostEnfazDecision("case-specialist"));
        Assert.False(AllowsPostEnfazDecision(null));
    }

    [Fact]
    public void Inspector_completion_releases_the_office_and_leaves_the_specialist_waiting_on_it_only()
    {
        var result = Evaluate(BaseInput(
            inspector: new PartyFacts(Assigned: true, Completed: true)));

        Assert.Equal(Statuses.InProgress,
            result.Parties.Single(p => p.Key == Parties.EngineeringOffice).Status);
        // The specialist is still waiting for the office.
        Assert.Equal(
            [Parties.EngineeringOffice],
            result.Parties.Single(p => p.Key == Parties.CaseSpecialist).WaitingOn);
    }

    [Fact]
    public void Transaction_without_survey_has_no_engineering_office_party()
    {
        var result = Evaluate(BaseInput(officeRequired: false));
        Assert.DoesNotContain(result.Parties, p => p.Key == Parties.EngineeringOffice);
        Assert.Equal(
            [Parties.Inspector],
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
            studyIssued: true,
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

    [Fact]
    public void Progress_percent_rises_with_completed_parties_before_valuation()
    {
        var early = ProgressPercent(BaseInput(phase: "enfath"));
        Assert.True(early is > 0 and < 40, $"early={early}");

        var afterParties = ProgressPercent(BaseInput(
            phase: "case_study",
            inspector: new PartyFacts(true, true),
            appraiser: new PartyFacts(true, false),
            office: new PartyFacts(true, true),
            specialist: new PartyFacts(true, false)));
        Assert.True(afterParties is >= 55 and < 85, $"afterParties={afterParties}");
        Assert.True(afterParties > early);

        var closed = ProgressPercent(BaseInput(
            phase: "done",
            inspector: new PartyFacts(true, true),
            appraiser: new PartyFacts(true, true),
            office: new PartyFacts(true, true),
            specialist: new PartyFacts(true, true),
            valuationClosed: true,
            handedOver: true));
        Assert.Equal(100, closed);
    }

    private static Input ReadyForHandover() => BaseInput(
        studyIssued: true,
        valuationClosed: true,
        inspector: new PartyFacts(true, true),
        appraiser: new PartyFacts(true, true),
        office: new PartyFacts(true, true),
        specialist: new PartyFacts(true, true));

    [Fact]
    public void Handover_needs_the_study_report_issued()
    {
        var ready = ReadyForHandover();
        Assert.True(AllowsEnfazHandover(ready));
        Assert.Empty(EnfazHandoverBlockReasonsAr(ready));

        // Everything else done, the case-study report never issued (a legacy completed parent).
        var notIssued = ready with { StudyReportIssued = false };
        Assert.False(AllowsEnfazHandover(notIssued));
        var reasons = EnfazHandoverBlockReasonsAr(notIssued);
        Assert.Single(reasons);
        Assert.Contains("تقرير دراسة الحالة", reasons[0]);
    }

    [Fact]
    public void Block_reasons_list_every_missing_condition()
    {
        var input = BaseInput(
            inspector: new PartyFacts(true, true),
            appraiser: new PartyFacts(true, false),
            office: new PartyFacts(true, true),
            specialist: new PartyFacts(true, false));

        var reasons = EnfazHandoverBlockReasonsAr(input);

        Assert.Equal(3, reasons.Count);
        Assert.Contains(reasons, r => r.Contains("تقرير دراسة الحالة"));
        Assert.Contains(reasons, r => r.Contains("شهادة الإيداع"));
        var parties = Assert.Single(reasons, r => r.StartsWith("لم يكتمل عمل", StringComparison.Ordinal));
        // The valuer's task completes only with the deposit — the deposit reason already says it.
        Assert.DoesNotContain(Parties.LabelAr(Parties.Appraiser), parties);
        Assert.Contains(Parties.LabelAr(Parties.CaseSpecialist), parties);
        Assert.DoesNotContain(Parties.LabelAr(Parties.Inspector), parties);
    }

    [Fact]
    public void A_submitted_valuer_waits_on_the_specialist_while_the_deposit_stage_is_in_progress()
    {
        var input = BaseInput(
            studyIssued: true,
            inspector: new PartyFacts(true, true),
            appraiser: new PartyFacts(true, false, Submitted: true),
            specialist: new PartyFacts(true, true));

        var result = Evaluate(input);

        var appraiser = result.Parties.Single(p => p.Key == Parties.Appraiser);
        Assert.Equal(Statuses.WaitingOnParty, appraiser.Status);
        Assert.Equal([Parties.CaseSpecialist], appraiser.WaitingOn);
        Assert.Equal(Statuses.InProgress, result.Stages.Single(s => s.Key == Stages.DepositCertificate).Status);
    }

    [Fact]
    public void A_valuer_who_has_not_submitted_keeps_the_deposit_stage_waiting()
    {
        var input = BaseInput(
            studyIssued: true,
            appraiser: new PartyFacts(true, false),
            specialist: new PartyFacts(true, true));

        var result = Evaluate(input);

        Assert.Equal(Statuses.WaitingOnParty, result.Stages.Single(s => s.Key == Stages.DepositCertificate).Status);
    }

    [Fact]
    public void Block_reasons_are_empty_exactly_when_the_handover_is_allowed()
    {
        foreach (var studyIssued in new[] { false, true })
        foreach (var valuationClosed in new[] { false, true })
        foreach (var specialistDone in new[] { false, true })
        {
            var input = BaseInput(
                studyIssued: studyIssued,
                valuationClosed: valuationClosed,
                inspector: new PartyFacts(true, true),
                appraiser: new PartyFacts(true, true),
                office: new PartyFacts(true, true),
                specialist: new PartyFacts(true, specialistDone));

            Assert.Equal(AllowsEnfazHandover(input), EnfazHandoverBlockReasonsAr(input).Count == 0);
        }
    }

    [Fact]
    public void A_handed_over_transaction_reports_only_that_fact()
    {
        var handedOver = ReadyForHandover() with { EnfazHandedOver = true };

        Assert.False(AllowsEnfazHandover(handedOver));
        Assert.Equal([AlreadyHandedOverAr], EnfazHandoverBlockReasonsAr(handedOver));
    }
}
