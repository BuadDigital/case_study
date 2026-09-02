using RealEstateEval.Application.Rules;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

public class InspectorFeeAccrualRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static WorkflowTask SurveyTask(
        WorkflowTaskStatus status = WorkflowTaskStatus.Completed,
        Guid? propertyId = null,
        int ordinal = 4) =>
        WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            " PO-1 ",
            Now,
            status: status,
            propertyId: propertyId ?? Guid.NewGuid(),
            propertyOrdinal: ordinal,
            assigneeId: "eo-1");

    private static PartyTaskSubmission Submission(string status = PartyTaskSubmissionStatus.Submitted) =>
        new() { Id = Guid.NewGuid(), Status = status };

    private static InspectorFeeLedger Ledger(
        string status = InspectorFeeBillingStatus.Draft,
        string inspectorType = InspectorFeeRules.TypeCooperatorIndividual,
        decimal fee = 400m,
        decimal discount = 0m,
        Guid? pricingTableId = null,
        DateTime? accruedAtUtc = null) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = Guid.NewGuid(),
            PoNumber = "PO-1",
            AssigneeId = "eo-1",
            InspectorType = inspectorType,
            BillingStatus = status,
            AgreedFeeSar = fee,
            SupervisorDiscountSar = discount,
            PricingTableId = pricingTableId,
            AccruedAtUtc = accruedAtUtc,
        };

    // ---- accrual guards ----

    [Fact]
    public void Accrual_is_only_for_a_submitted_completed_survey()
    {
        var caseStudyTask = WorkflowTask.Create(WorkflowTaskKind.CaseStudyProperty, "PO-1", Now);
        Assert.Equal(
            "الاستحقاق خاص بمهام الرفع المساحي فقط.",
            InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(caseStudyTask, Submission()));

        Assert.Equal(
            "لا يمكن الاستحقاق قبل إرسال المخرجات وقبولها.",
            InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(SurveyTask(), null));
        Assert.Equal(
            "لا يمكن الاستحقاق قبل إرسال المخرجات وقبولها.",
            InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(
                SurveyTask(),
                Submission(PartyTaskSubmissionStatus.Draft)));

        Assert.Equal(
            "مهمة الرفع المساحي غير مكتملة.",
            InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(
                SurveyTask(WorkflowTaskStatus.Open),
                Submission()));

        Assert.Null(InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(
            SurveyTask(),
            Submission()));
    }

    [Fact]
    public void A_ledger_counts_as_accrued_only_when_dated_and_priced()
    {
        Assert.False(InspectorFeeAccrualRules.IsAccrued(Ledger()));
        Assert.False(InspectorFeeAccrualRules.IsAccrued(Ledger(fee: 0m, accruedAtUtc: Now)));
        Assert.True(InspectorFeeAccrualRules.IsAccrued(Ledger(accruedAtUtc: Now)));
    }

    [Fact]
    public void Every_target_deed_accrued_makes_the_accrual_a_no_op()
    {
        var deedA = Guid.NewGuid();
        var deedB = Guid.NewGuid();
        var accruedA = Ledger(accruedAtUtc: Now);
        accruedA.DeedId = deedA;
        var accruedB = Ledger(accruedAtUtc: Now);
        accruedB.DeedId = deedB;

        var targets = new List<InspectorFeeDeedTarget>
        {
            new(deedA, Guid.NewGuid()),
            new(deedB, Guid.NewGuid()),
        };

        Assert.True(InspectorFeeAccrualRules.AllDeedsAccrued(targets, [accruedA, accruedB]));
        Assert.False(InspectorFeeAccrualRules.AllDeedsAccrued(targets, [accruedA]));
        Assert.False(InspectorFeeAccrualRules.AllDeedsAccrued([], [accruedA]));
    }

    [Fact]
    public void The_task_property_keeps_the_task_ordinal_and_extra_deeds_count_on()
    {
        var propertyId = Guid.NewGuid();
        var task = SurveyTask(propertyId: propertyId, ordinal: 4);

        Assert.Equal(
            4,
            InspectorFeeAccrualRules.PropertyOrdinalFor(task, new InspectorFeeDeedTarget(Guid.NewGuid(), propertyId), 9));
        Assert.Equal(
            9,
            InspectorFeeAccrualRules.PropertyOrdinalFor(task, new InspectorFeeDeedTarget(Guid.NewGuid(), Guid.NewGuid()), 9));
    }

    [Fact]
    public void A_new_accrued_ledger_lands_at_finance_with_no_discount()
    {
        var propertyId = Guid.NewGuid();
        var task = SurveyTask(propertyId: propertyId);
        var identity = (TransactionId: Guid.NewGuid(), DeedId: Guid.NewGuid(), UserId: "u-1");
        var pricingTableId = Guid.NewGuid();

        var ledger = InspectorFeeAccrualRules.NewAccruedLedger(
            task,
            identity,
            new InspectorFeeDeedTarget(identity.DeedId, propertyId),
            1,
            InspectorFeeRules.TypeCooperatorOrganization,
            750m,
            pricingTableId,
            Now);

        Assert.Equal("PO-1", ledger.PoNumber);
        Assert.Equal(task.Id, ledger.WorkflowTaskId);
        Assert.Equal(identity.TransactionId, ledger.TransactionId);
        Assert.Equal(750m, ledger.AgreedFeeSar);
        Assert.Equal(pricingTableId, ledger.PricingTableId);
        Assert.Equal(0m, ledger.SupervisorDiscountSar);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, ledger.BillingStatus);
        Assert.Equal(Now, ledger.AccruedAtUtc);
        Assert.Equal(task.PropertyOrdinal, ledger.PropertyOrdinal);
    }

    [Fact]
    public void Re_accrual_keeps_a_discounted_line_in_office_review()
    {
        var task = SurveyTask();
        var identity = (TransactionId: Guid.NewGuid(), DeedId: Guid.NewGuid(), UserId: "u-1");
        var deed = new InspectorFeeDeedTarget(identity.DeedId, Guid.NewGuid());

        var discounted = Ledger(discount: 50m, status: InspectorFeeBillingStatus.Draft);
        InspectorFeeAccrualRules.RefreshAccruedLedger(
            discounted, task, identity, deed, 2, InspectorFeeRules.TypeCooperatorIndividual, 900m, null, Now);
        Assert.Equal(InspectorFeeBillingStatus.OfficeReview, discounted.BillingStatus);
        Assert.Equal(900m, discounted.AgreedFeeSar);
        Assert.Equal(Now, discounted.AccruedAtUtc);

        var clean = Ledger(discount: 0m, status: InspectorFeeBillingStatus.Draft);
        clean.DiscountReason = "قديم";
        InspectorFeeAccrualRules.RefreshAccruedLedger(
            clean, task, identity, deed, 2, InspectorFeeRules.TypeCooperatorIndividual, 900m, null, Now);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, clean.BillingStatus);
        Assert.Null(clean.DiscountReason);
    }

    [Fact]
    public void The_accrual_audit_row_has_no_prior_status()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.AtFinance);
        var transition = InspectorFeeAccrualRules.AccrualTransition(ledger, "u-9", Now);

        Assert.Equal("—", transition.FromStatus);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, transition.ToStatus);
        Assert.Equal(InspectorFeeAccrualRules.AccrualReason, transition.Reason);
        Assert.Equal("u-9", transition.ActorUserId);
        Assert.Equal(Now, transition.CreatedAtUtc);
    }

    [Fact]
    public void On_site_area_is_read_from_the_survey_payload()
    {
        Assert.Null(InspectorFeeAccrualRules.TryParseSurveyOnSiteAreaM2(""));
        Assert.Null(InspectorFeeAccrualRules.TryParseSurveyOnSiteAreaM2("{not json"));
        Assert.Null(InspectorFeeAccrualRules.TryParseSurveyOnSiteAreaM2("{}"));
        Assert.Equal(
            520m,
            InspectorFeeAccrualRules.TryParseSurveyOnSiteAreaM2("{\"onSiteAreaSqm\":\"520\"}"));
    }

    // ---- patch ----

    [Fact]
    public void A_patch_is_refused_on_a_non_editable_status()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.Disbursed);
        Assert.False(InspectorFeeAccrualRules.TryApplyPatch(ledger, new PatchInspectorFeeRequest()));
    }

    [Fact]
    public void A_hand_priced_fee_is_only_for_an_unpriced_employee_row()
    {
        Assert.False(InspectorFeeAccrualRules.TryApplyPatch(
            Ledger(),
            new PatchInspectorFeeRequest { AgreedFeeSar = 300m }));

        Assert.False(InspectorFeeAccrualRules.TryApplyPatch(
            Ledger(inspectorType: InspectorFeeRules.TypeEmployee, pricingTableId: Guid.NewGuid()),
            new PatchInspectorFeeRequest { AgreedFeeSar = 300m }));

        var employee = Ledger(inspectorType: InspectorFeeRules.TypeEmployee, fee: 0m);
        Assert.True(InspectorFeeAccrualRules.TryApplyPatch(
            employee,
            new PatchInspectorFeeRequest { AgreedFeeSar = -5m }));
        Assert.Equal(0m, employee.AgreedFeeSar);
    }

    [Fact]
    public void Changing_a_disputed_discount_cancels_the_negotiation_deadline()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.Disputed, discount: 50m);
        ledger.DisputeDeadlineUtc = Now;
        ledger.DisputeNotifiedStages = "d3";

        Assert.True(InspectorFeeAccrualRules.TryApplyPatch(
            ledger,
            new PatchInspectorFeeRequest { SupervisorDiscountSar = 75m, DiscountReason = " سبب " }));

        Assert.Null(ledger.DisputeDeadlineUtc);
        Assert.Null(ledger.DisputeNotifiedStages);
        Assert.Equal(75m, ledger.SupervisorDiscountSar);
        Assert.Equal("سبب", ledger.DiscountReason);
    }

    [Fact]
    public void A_discount_without_a_reason_is_refused()
    {
        var ledger = Ledger();
        Assert.False(InspectorFeeAccrualRules.TryApplyPatch(
            ledger,
            new PatchInspectorFeeRequest { SupervisorDiscountSar = 60m }));
    }

    [Fact]
    public void Excluding_a_line_needs_a_reason_and_clearing_it_drops_the_old_one()
    {
        var missingReason = Ledger();
        Assert.False(InspectorFeeAccrualRules.TryApplyPatch(
            missingReason,
            new PatchInspectorFeeRequest { ExcludedFromBatch = true }));

        var restored = Ledger();
        restored.ExclusionReason = "قديم";
        Assert.True(InspectorFeeAccrualRules.TryApplyPatch(
            restored,
            new PatchInspectorFeeRequest { ExcludedFromBatch = false }));
        Assert.Null(restored.ExclusionReason);
    }

    [Fact]
    public void A_zeroed_discount_drops_its_reason()
    {
        var ledger = Ledger(discount: 40m);
        ledger.DiscountReason = "سبب";

        Assert.True(InspectorFeeAccrualRules.TryApplyPatch(
            ledger,
            new PatchInspectorFeeRequest { SupervisorDiscountSar = 0m }));
        Assert.Null(ledger.DiscountReason);
    }

    [Fact]
    public void A_discount_only_counts_when_the_request_sent_one()
    {
        var ledger = Ledger(discount: 40m);
        Assert.False(InspectorFeeAccrualRules.DiscountApplied(ledger, new PatchInspectorFeeRequest()));
        Assert.True(InspectorFeeAccrualRules.DiscountApplied(
            ledger,
            new PatchInspectorFeeRequest { SupervisorDiscountSar = 40m }));
    }

    [Fact]
    public void A_discounted_employee_line_goes_straight_to_finance()
    {
        var ledger = Ledger(
            status: InspectorFeeBillingStatus.OfficeReview,
            inspectorType: InspectorFeeRules.TypeEmployee,
            discount: 30m);

        InspectorFeeAccrualRules.ApplyStatusAfterPatch(
            ledger,
            WorkflowTaskKind.FieldInspection,
            isEmployee: true,
            discountApplied: true);

        Assert.Equal(InspectorFeeBillingStatus.AtFinance, ledger.BillingStatus);
    }

    [Fact]
    public void A_discounted_cooperator_survey_line_needs_office_approval()
    {
        var ledger = Ledger(
            status: InspectorFeeBillingStatus.AtFinance,
            discount: 30m,
            accruedAtUtc: Now);

        InspectorFeeAccrualRules.ApplyStatusAfterPatch(
            ledger,
            WorkflowTaskKind.EngineeringSurvey,
            isEmployee: false,
            discountApplied: true);

        Assert.Equal(InspectorFeeBillingStatus.OfficeReview, ledger.BillingStatus);
    }

    [Fact]
    public void An_undiscounted_cooperator_survey_line_returns_to_finance()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.OfficeReview, accruedAtUtc: Now);

        InspectorFeeAccrualRules.ApplyStatusAfterPatch(
            ledger,
            WorkflowTaskKind.EngineeringSurvey,
            isEmployee: false,
            discountApplied: false);

        Assert.Equal(InspectorFeeBillingStatus.AtFinance, ledger.BillingStatus);
    }

    [Fact]
    public void A_non_survey_cooperator_line_is_left_where_it_is()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.OfficeReview, accruedAtUtc: Now);

        InspectorFeeAccrualRules.ApplyStatusAfterPatch(
            ledger,
            WorkflowTaskKind.FieldInspection,
            isEmployee: false,
            discountApplied: false);

        Assert.Equal(InspectorFeeBillingStatus.OfficeReview, ledger.BillingStatus);
    }

    [Fact]
    public void An_unaccrued_survey_line_is_left_where_it_is()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.OfficeReview);

        InspectorFeeAccrualRules.ApplyStatusAfterPatch(
            ledger,
            WorkflowTaskKind.EngineeringSurvey,
            isEmployee: false,
            discountApplied: false);

        Assert.Equal(InspectorFeeBillingStatus.OfficeReview, ledger.BillingStatus);
    }

    [Fact]
    public void The_patch_audit_row_carries_the_discount_reason()
    {
        var ledger = Ledger(status: InspectorFeeBillingStatus.AtFinance, discount: 10m);
        ledger.DiscountReason = "سبب";

        var transition = InspectorFeeAccrualRules.PatchTransition(
            ledger,
            InspectorFeeBillingStatus.Draft,
            Now);

        Assert.Equal(InspectorFeeBillingStatus.Draft, transition.FromStatus);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, transition.ToStatus);
        Assert.Equal("سبب", transition.Reason);
        Assert.Equal("system", transition.ActorUserId);
    }

    // ---- transitions ----

    [Fact]
    public void A_single_candidate_is_always_picked()
    {
        var only = Ledger(status: InspectorFeeBillingStatus.Disbursed);
        Assert.Same(
            only,
            InspectorFeeAccrualRules.PickLedgerForTransition(
                [only],
                InspectorFeeActions.SubmitToSupervisor,
                null));
        Assert.Null(InspectorFeeAccrualRules.PickLedgerForTransition(
            [],
            InspectorFeeActions.SubmitToSupervisor,
            null));
    }

    [Fact]
    public void An_assignee_scoped_action_skips_another_party_row()
    {
        var otherParty = Ledger(status: InspectorFeeBillingStatus.Draft);
        otherParty.AssigneeId = "eo-2";
        var mine = Ledger(status: InspectorFeeBillingStatus.Draft);

        var picked = InspectorFeeAccrualRules.PickLedgerForTransition(
            [otherParty, mine],
            InspectorFeeActions.SubmitToSupervisor,
            "eo-1");

        Assert.Same(mine, picked);
    }

    [Fact]
    public void Submitting_skips_excluded_and_unpriced_rows()
    {
        var excluded = Ledger(status: InspectorFeeBillingStatus.Draft);
        excluded.ExcludedFromBatch = true;
        var unpriced = Ledger(status: InspectorFeeBillingStatus.Draft, fee: 0m);
        var good = Ledger(status: InspectorFeeBillingStatus.Draft);

        Assert.Same(
            good,
            InspectorFeeAccrualRules.PickLedgerForTransition(
                [excluded, unpriced, good],
                InspectorFeeActions.SubmitToSupervisor,
                "eo-1"));
    }

    [Theory]
    [InlineData("disburse", true)]
    [InlineData("  DISBURSE ", true)]
    [InlineData("suspend", false)]
    public void The_disburse_action_is_matched_case_insensitively(string action, bool expected)
    {
        Assert.Equal(expected, InspectorFeeAccrualRules.IsDisburseAction(action));
        Assert.Equal(action.Trim().ToLowerInvariant(), InspectorFeeAccrualRules.NormalizeAction(action));
    }

    [Fact]
    public void A_batch_line_reuses_the_batch_action_reason_and_voucher()
    {
        var line = InspectorFeeAccrualRules.BatchLineRequest(new BatchInspectorFeeTransitionRequest
        {
            Action = "disburse",
            Reason = "سبب",
            DisbursementVoucher = "V-1",
            WorkflowTaskIds = [],
        });

        Assert.Equal("disburse", line.Action);
        Assert.Equal("سبب", line.Reason);
        Assert.Equal("V-1", line.DisbursementVoucher);
    }

    [Fact]
    public void Disbursement_batches_are_retired()
    {
        var response = InspectorFeeAccrualRules.RetiredDisbursementBatchResponse();
        var failure = Assert.Single(response.Failed);
        Assert.Equal("", failure.WorkflowTaskId);
        Assert.Contains("كشف الأطراف", failure.Error);
    }

    // ---- notifications ----

    [Fact]
    public void Distinct_assignee_ids_drop_blanks_and_duplicates()
    {
        var ids = InspectorFeeAccrualRules.DistinctAssigneeIds([
            new InspectorFeeRowDto { WorkflowTaskId = "1", AssigneeId = " a " },
            new InspectorFeeRowDto { WorkflowTaskId = "2", AssigneeId = "a" },
            new InspectorFeeRowDto { WorkflowTaskId = "3", AssigneeId = "  " },
            new InspectorFeeRowDto { WorkflowTaskId = "4", AssigneeId = null },
            new InspectorFeeRowDto { WorkflowTaskId = "5", AssigneeId = "b" },
        ]);

        Assert.Equal(["a", "b"], ids);
    }

    [Fact]
    public void The_employee_discount_notification_names_the_net_fee()
    {
        var ledger = Ledger(fee: 1000m, discount: 250m);
        var notification = InspectorFeeAccrualRules.EmployeeDiscountNotification(ledger);

        Assert.Equal("خصم على أتعابك", notification.Title);
        Assert.Contains("PO-1", notification.Body);
        Assert.Contains("750", notification.Body);
        Assert.Equal($"fee-discount-notified:{ledger.WorkflowTaskId:N}", notification.SourceEvent);
    }

    [Fact]
    public void The_disbursed_notification_points_at_the_task()
    {
        var row = new InspectorFeeRowDto { WorkflowTaskId = "t-1", PropertyLabel = "R-1" };
        var notification = InspectorFeeAccrualRules.FeeDisbursedNotification(row);

        Assert.Equal("تم صرف الأتعاب", notification.Title);
        Assert.Contains("R-1", notification.Body);
        Assert.Equal("t-1", notification.EntityId);
        Assert.Equal("fee-disbursed:t-1", notification.SourceEvent);
    }
}
