using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Engineering-office fee discounts (ruling of 2026-10-26): the specialist proposes a discount when
/// accepting the outputs, the department supervisor decides it — approve, amend or waive — and only
/// then does the line reach finance. Without a proposal the fee goes straight to finance.
/// </summary>
public class DiscountProposalTests
{
    private const decimal SurveyRate = 1200m;
    private const string Office = "eng-office-1";

    [Fact]
    public async Task Accepting_without_a_proposal_sends_the_fee_straight_to_finance()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-1");

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy)
            .AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1");

        Assert.Null(error);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, row!.BillingStatus);
        Assert.Null(row.ProposedDiscountSar);
        Assert.Empty(await db.Financial.DiscountFlags.ToListAsync());
    }

    [Fact]
    public async Task A_proposal_parks_the_fee_with_the_supervisor_at_full_amount()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-2");

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy)
            .AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1", proposal: Proposal(200m));

        Assert.Null(error);
        Assert.Equal(InspectorFeeBillingStatus.SupReview, row!.BillingStatus);
        Assert.Equal(0m, row.SupervisorDiscountSar);
        Assert.Equal(SurveyRate, row.NetFeeSar);
        Assert.Equal(200m, row.ProposedDiscountSar);
        Assert.Equal("أخصائي", row.ProposedByName);
        Assert.True(row.CanResolveDiscountProposal);
        Assert.False(row.CanApproveToFinance);
        Assert.False(row.IsEditable);

        var flag = await db.Financial.DiscountFlags.SingleAsync();
        Assert.Equal(DiscountFlagStatuses.Pending, flag.Status);
        Assert.Equal(taskId, flag.WorkflowTaskId);
        Assert.Equal(Office, flag.TargetAssigneeId);
    }

    [Fact]
    public async Task A_proposal_above_the_fee_is_refused_and_nothing_is_saved()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-3");

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy)
            .AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1", proposal: Proposal(SurveyRate + 1m));

        Assert.Null(row);
        Assert.Contains("لا يتجاوز", error);
        Assert.Empty(await db.Financial.InspectorFeeLedgers.ToListAsync());
        Assert.Empty(await db.Financial.DiscountFlags.ToListAsync());
    }

    [Theory]
    [InlineData(DiscountProposalDecisions.Approve, null, 200, DiscountFlagStatuses.Approved)]
    [InlineData(DiscountProposalDecisions.Amend, 80, 80, DiscountFlagStatuses.Amended)]
    [InlineData(DiscountProposalDecisions.Waive, null, 0, DiscountFlagStatuses.Waived)]
    public async Task Each_decision_applies_its_discount_and_sends_the_line_to_finance(
        string decision,
        int? amendedSar,
        int expectedDiscount,
        string expectedStatus)
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-4");
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);
        await service.AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1", proposal: Proposal(200m));

        var (row, error) = await service.ResolveDiscountProposalAsync(
            taskId,
            new ResolveDiscountProposalRequest { Decision = decision, AmountSar = amendedSar },
            "supervisor-1",
            canManageAllDepartments: true);

        Assert.Null(error);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, row!.BillingStatus);
        Assert.Equal(expectedDiscount, row.SupervisorDiscountSar);
        Assert.Equal(SurveyRate - expectedDiscount, row.NetFeeSar);
        Assert.False(row.CanResolveDiscountProposal);

        var flag = await db.Financial.DiscountFlags.AsNoTracking().SingleAsync();
        Assert.Equal(expectedStatus, flag.Status);
        Assert.Equal(expectedDiscount, flag.ResolvedDiscountSar);
        Assert.Equal("supervisor-1", flag.ResolvedByUserId);
    }

    [Fact]
    public async Task Amending_needs_an_amount_within_the_fee()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-5");
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);
        await service.AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1", proposal: Proposal(200m));

        var (_, missing) = await service.ResolveDiscountProposalAsync(
            taskId,
            new ResolveDiscountProposalRequest { Decision = DiscountProposalDecisions.Amend },
            "supervisor-1",
            canManageAllDepartments: true);
        var (_, tooBig) = await service.ResolveDiscountProposalAsync(
            taskId,
            new ResolveDiscountProposalRequest
            {
                Decision = DiscountProposalDecisions.Amend,
                AmountSar = SurveyRate + 1m,
            },
            "supervisor-1",
            canManageAllDepartments: true);

        Assert.NotNull(missing);
        Assert.Contains("لا يتجاوز", tooBig);
        var stored = await db.Financial.InspectorFeeLedgers.AsNoTracking().SingleAsync();
        Assert.Equal(InspectorFeeBillingStatus.SupReview, stored.BillingStatus);
    }

    /// <summary>
    /// A plain approval or a direct discount would let the full fee — or another amount — slip past
    /// the proposal, so both wait until the proposal is decided.
    /// </summary>
    [Fact]
    public async Task A_pending_proposal_blocks_plain_approval_and_direct_discounts()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-6");
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);
        await service.AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1", proposal: Proposal(200m));

        var (approved, approveError) = await service.TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest { Action = InspectorFeeActions.ApproveToFinance },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            canManageAllDepartments: true);
        var patched = await service.PatchAsync(
            taskId,
            new PatchInspectorFeeRequest { SupervisorDiscountSar = 50m, DiscountReason = "سبب" },
            canManageAllDepartments: true);

        Assert.Null(approved);
        Assert.NotNull(approveError);
        Assert.Null(patched);
        var stored = await db.Financial.InspectorFeeLedgers.AsNoTracking().SingleAsync();
        Assert.Equal(InspectorFeeBillingStatus.SupReview, stored.BillingStatus);
        Assert.Equal(0m, stored.SupervisorDiscountSar);
    }

    [Fact]
    public async Task A_second_proposal_while_one_is_pending_is_refused()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-7");
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);
        await service.AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1", proposal: Proposal(200m));

        var (row, error) = await service.AccrueEngineeringSurveyFeeAsync(
            taskId, "specialist-1", proposal: Proposal(100m));

        Assert.Null(row);
        Assert.NotNull(error);
        Assert.Single(await db.Financial.DiscountFlags.ToListAsync());
    }

    /// <summary>
    /// A proposal sent with a re-acceptance — the fee already accrued and sits at finance — still
    /// reaches the supervisor on the line finance has not billed yet.
    /// </summary>
    [Fact]
    public async Task A_late_proposal_pulls_an_unbilled_line_back_to_the_supervisor()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-8");
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);
        await service.AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1");

        var (row, error) = await service.AccrueEngineeringSurveyFeeAsync(
            taskId, "specialist-1", proposal: Proposal(150m));

        Assert.Null(error);
        Assert.Equal(InspectorFeeBillingStatus.SupReview, row!.BillingStatus);
        Assert.Equal(150m, row.ProposedDiscountSar);
    }

    /// <summary>A line already cancelled in full is decided; a later proposal cannot reopen it.</summary>
    [Fact]
    public async Task A_late_proposal_does_not_reopen_a_cancelled_line()
    {
        await using var db = CreateDb();
        var taskId = await SeedAcceptableSurveyAsync(db, "PO-DP-9");
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);
        await service.AccrueEngineeringSurveyFeeAsync(taskId, "specialist-1");
        await service.WaivePartyFeesAsync(
            "PO-DP-9",
            new WaivePartyFeesRequest { AssigneeId = Office, Reason = "لم يُنجز العمل" },
            "supervisor-1",
            canManageAllDepartments: true);

        var (row, error) = await service.AccrueEngineeringSurveyFeeAsync(
            taskId, "specialist-1", proposal: Proposal(150m));

        Assert.Null(row);
        Assert.NotNull(error);
        var stored = await db.Financial.InspectorFeeLedgers.AsNoTracking().SingleAsync();
        Assert.Equal(SurveyRate, stored.SupervisorDiscountSar);
        Assert.True(stored.ExcludedFromBatch);
    }

    [Fact]
    public async Task Finance_sees_neither_the_line_awaiting_a_decision_nor_its_money()
    {
        await using var db = CreateDb();
        var (awaitingId, readyId) = await SeedAwaitingAndReadyAsync(db);
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);

        var finance = await service.GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            hideAwaitingDiscountDecision: true);
        var operations = await service.GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false,
            hideAwaitingDiscountDecision: false);

        Assert.Single(finance.Rows);
        Assert.Equal(readyId.ToString(), finance.Rows[0].WorkflowTaskId);
        Assert.Equal(0m, finance.SupReviewSar);
        Assert.Equal(2, operations.Rows.Count);
        Assert.Contains(operations.Rows, r => r.WorkflowTaskId == awaitingId.ToString());
    }

    /// <summary>
    /// Cancelling a party's fee on a whole transaction discounts every open line in full and keeps
    /// the zero lines out of statements; a line already in a statement is left for finance.
    /// </summary>
    [Fact]
    public async Task Waiving_a_party_cancels_open_lines_and_reports_the_billed_ones()
    {
        await using var db = CreateDb();
        var openId = SeedLedger(db, "PO-DP-W", InspectorFeeBillingStatus.AtFinance);
        var pendingId = SeedLedger(db, "PO-DP-W", InspectorFeeBillingStatus.SupReview);
        var billedId = SeedLedger(db, "PO-DP-W", InspectorFeeBillingStatus.InStatement);
        db.Financial.DiscountFlags.Add(PendingFlag(pendingId, "PO-DP-W"));
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var (result, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy)
            .WaivePartyFeesAsync(
                "PO-DP-W",
                new WaivePartyFeesRequest { AssigneeId = Office, Reason = "لم يُنجز العمل" },
                "supervisor-1",
                canManageAllDepartments: true);

        Assert.Null(error);
        Assert.Equal(2, result!.WaivedCount);
        Assert.Equal(billedId.ToString(), Assert.Single(result.Skipped).WorkflowTaskId);

        var ledgers = await db.Financial.InspectorFeeLedgers.AsNoTracking().ToListAsync();
        foreach (var waived in ledgers.Where(l => l.WorkflowTaskId != billedId))
        {
            Assert.Equal(InspectorFeeBillingStatus.AtFinance, waived.BillingStatus);
            Assert.Equal(waived.AgreedFeeSar, waived.SupervisorDiscountSar);
            Assert.True(waived.ExcludedFromBatch);
        }

        var billed = ledgers.Single(l => l.WorkflowTaskId == billedId);
        Assert.Equal(0m, billed.SupervisorDiscountSar);
        Assert.Equal(
            DiscountFlagStatuses.Amended,
            (await db.Financial.DiscountFlags.AsNoTracking().SingleAsync()).Status);
        Assert.Contains(ledgers, l => l.WorkflowTaskId == openId);
    }

    [Fact]
    public async Task Waiving_needs_a_reason_and_the_transactions_department()
    {
        await using var db = CreateDb();
        SeedLedger(db, "PO-DP-X", InspectorFeeBillingStatus.AtFinance);
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db.CaseStudy);

        var (_, noReason) = await service.WaivePartyFeesAsync(
            "PO-DP-X",
            new WaivePartyFeesRequest { AssigneeId = Office, Reason = " " },
            "supervisor-1",
            canManageAllDepartments: true);
        var (_, otherDepartment) = await service.WaivePartyFeesAsync(
            "PO-DP-X",
            new WaivePartyFeesRequest { AssigneeId = Office, Reason = "لم يُنجز العمل" },
            "supervisor-1",
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Contains("سبب", noReason);
        Assert.Contains("قسماً آخر", otherDepartment);
        var stored = await db.Financial.InspectorFeeLedgers.AsNoTracking().SingleAsync();
        Assert.Equal(0m, stored.SupervisorDiscountSar);
    }

    private static EngineeringSurveyDiscountProposalInput Proposal(decimal amount) => new()
    {
        ProposedDiscountSar = amount,
        DiscountReason = "نقص في مرفقات الرفع المساحي",
        ProposedByName = "أخصائي",
    };

    private static async Task<Guid> SeedAcceptableSurveyAsync(
        TestDatabases.ContextSet db,
        string poNumber)
    {
        await SetSurveyTierAsync(db.Financial, Office, SurveyRate);
        var propertyId = Guid.NewGuid();
        db.CaseStudy.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = propertyId,
            WorkOrderId = Guid.NewGuid(),
            Area = "300",
        });
        var task = SurveyTask(Guid.NewGuid(), poNumber, propertyId);
        db.CaseStudy.WorkflowTasks.Add(task);
        db.CaseStudy.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = task.Id,
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = propertyId,
            PoNumber = poNumber,
            SubmittedAtUtc = DateTime.UtcNow,
        });
        await db.CaseStudy.SaveChangesAsync();
        return task.Id;
    }

    private static async Task<(Guid AwaitingId, Guid ReadyId)> SeedAwaitingAndReadyAsync(
        TestDatabases.ContextSet db)
    {
        var awaitingId = SeedLedger(db, "PO-DP-V", InspectorFeeBillingStatus.SupReview, 900m);
        var readyId = SeedLedger(db, "PO-DP-V", InspectorFeeBillingStatus.AtFinance, 450m);
        db.Financial.DiscountFlags.Add(PendingFlag(awaitingId, "PO-DP-V"));
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();
        return (awaitingId, readyId);
    }

    /// <summary>
    /// Engineering-survey ledgers become visible on accrual alone, which keeps the fixture free of
    /// the completed-case-study gate that other party fees sit behind.
    /// </summary>
    private static Guid SeedLedger(
        TestDatabases.ContextSet db,
        string poNumber,
        string billingStatus,
        decimal agreedFeeSar = 600m)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.CaseStudy.WorkflowTasks.Add(SurveyTask(taskId, poNumber, propertyId: null));
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            TransactionId = Guid.NewGuid(),
            DeedId = Guid.NewGuid(),
            UserId = Office,
            PoNumber = poNumber,
            AssigneeId = Office,
            InspectorType = "متعاون شركة",
            AgreedFeeSar = agreedFeeSar,
            BillingStatus = billingStatus,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static DiscountFlag PendingFlag(Guid taskId, string poNumber) => new()
    {
        Id = Guid.NewGuid(),
        TransactionKey = poNumber,
        WorkflowTaskId = taskId,
        TargetAssigneeId = Office,
        FlaggedByUserId = "specialist-1",
        Reason = "تأخّر تسليم التقرير المساحي",
        ProposedDiscountSar = 100m,
        Status = DiscountFlagStatuses.Pending,
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow,
    };

    private static WorkflowTask SurveyTask(Guid id, string poNumber, Guid? propertyId) =>
        WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            poNumber,
            DateTime.UtcNow,
            status: WorkflowTaskStatus.Completed,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب هندسي",
            id: id,
            assigneeId: Office,
            propertyId: propertyId);

    private static async Task SetSurveyTierAsync(
        FinancialDbContext db,
        string assigneeId,
        decimal feeSar)
    {
        var tableId = Guid.NewGuid();
        db.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = tableId,
            Category = PartyFeePricingCategories.EngineeringSurvey,
            Name = "اختبار",
            IsActive = true,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        db.PartyFeePricingTiers.Add(new PartyFeePricingTier
        {
            Id = Guid.NewGuid(),
            TableId = tableId,
            SortOrder = 0,
            MaxAreaM2 = null,
            FeeSar = feeSar,
        });
        db.PartyFeePricingAssignments.Add(new PartyFeePricingAssignment
        {
            Id = Guid.NewGuid(),
            TableId = tableId,
            Category = PartyFeePricingCategories.EngineeringSurvey,
            AssigneeId = assigneeId,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static TestDatabases.ContextSet CreateDb() =>
        TestDatabases.Create("discount-proposal");
}
