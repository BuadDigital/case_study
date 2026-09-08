using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>Draft assembly rules extracted out of PartyBillingStatementService.</summary>
public class PartyBillingDraftRulesTests
{
    private static readonly DateTime Now = new(2026, 3, 2, 8, 0, 0, DateTimeKind.Utc);

    private static InspectorFeeLedger Ledger(
        Guid taskId,
        decimal fee = 100m,
        decimal discount = 0m,
        Guid? propertyId = null) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = taskId,
            AssigneeId = "vendor-1",
            UserId = "vendor-1",
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AgreedFeeSar = fee,
            SupervisorDiscountSar = discount,
            PropertyId = propertyId,
        };

    private static PartyBillingReadyLineDto Ready(string payeeType, string? assigneeId, string taskId) => new()
    {
        WorkflowTaskId = taskId,
        PayeeType = payeeType,
        AssigneeId = assigneeId,
    };

    // ---- ledger draft ----

    [Fact]
    public void Ledger_draft_has_one_line_per_task_with_the_summed_net()
    {
        var taskA = Guid.NewGuid();
        var taskB = Guid.NewGuid();
        var statementId = Guid.NewGuid();
        var twinA1 = Ledger(taskA, fee: 100m, discount: 10m);
        var twinA2 = Ledger(taskA, fee: 50m);
        var single = Ledger(taskB, fee: 70m);

        var draft = PartyBillingDraftRules.BuildLedgerDraft(
            statementId,
            [
                new KeyValuePair<Guid, List<InspectorFeeLedger>>(taskA, [twinA1, twinA2]),
                new KeyValuePair<Guid, List<InspectorFeeLedger>>(taskB, [single]),
            ],
            "DS-2026-00001",
            "u-1",
            Now);

        Assert.Equal(210m, draft.TotalNetSar);
        Assert.Equal(2, draft.Lines.Count);
        Assert.Equal(140m, draft.Lines.Single(l => l.WorkflowTaskId == taskA).NetFeeSar);
        Assert.Equal(70m, draft.Lines.Single(l => l.WorkflowTaskId == taskB).NetFeeSar);
        Assert.All(draft.Lines, l => Assert.Equal(statementId, l.StatementId));
    }

    [Fact]
    public void Ledger_draft_binds_every_ledger_to_the_statement_and_records_the_move()
    {
        var task = Guid.NewGuid();
        var statementId = Guid.NewGuid();
        var ledger = Ledger(task);

        var draft = PartyBillingDraftRules.BuildLedgerDraft(
            statementId,
            [new KeyValuePair<Guid, List<InspectorFeeLedger>>(task, [ledger])],
            "DS-2026-00001",
            "u-1",
            Now);

        Assert.Equal(InspectorFeeBillingStatus.InStatement, ledger.BillingStatus);
        Assert.Equal(statementId, ledger.PartyBillingStatementId);
        Assert.Equal(Now, ledger.UpdatedAtUtc);

        var transition = Assert.Single(draft.Transitions);
        Assert.Equal(task, transition.WorkflowTaskId);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, transition.FromStatus);
        Assert.Equal(InspectorFeeBillingStatus.InStatement, transition.ToStatus);
        Assert.Equal("إدراج في كشف DS-2026-00001", transition.Reason);
        Assert.Equal("u-1", transition.ActorUserId);
    }

    // ---- court-visit lines + header ----

    [Fact]
    public void Court_visit_lines_are_keyed_by_the_charge()
    {
        var statementId = Guid.NewGuid();
        var charge = new CourtVisitFeeCharge { Id = Guid.NewGuid(), AmountSar = 150m };

        var line = Assert.Single(PartyBillingDraftRules.CourtVisitLines(statementId, [charge]));

        Assert.Equal(charge.Id, line.WorkflowTaskId);
        Assert.Equal(150m, line.NetFeeSar);
        Assert.Equal(statementId, line.StatementId);
    }

    [Fact]
    public void New_draft_is_a_draft_with_normalised_notes_and_its_lines()
    {
        var statementId = Guid.NewGuid();
        var lines = new List<PartyBillingStatementLine> { new() { Id = Guid.NewGuid(), StatementId = statementId } };

        var draft = PartyBillingDraftRules.NewDraft(
            statementId,
            "DS-2026-00002",
            "vendor-1",
            PartyBillingPayeeType.Vendor,
            WorkflowTaskKind.EngineeringSurvey.ToDbValue(),
            210m,
            "  ملاحظة  ",
            "u-1",
            Now,
            lines);

        Assert.Equal(statementId, draft.Id);
        Assert.Equal("DS-2026-00002", draft.ReferenceNumber);
        Assert.Equal(PartyBillingStatementStatus.Draft, draft.Status);
        Assert.Equal(PartyBillingPayeeType.Vendor, draft.PayeeType);
        Assert.Equal(WorkflowTaskKind.EngineeringSurvey.ToDbValue(), draft.TaskKind);
        Assert.Equal(210m, draft.TotalNetSar);
        Assert.Equal("ملاحظة", draft.Notes);
        Assert.Equal("u-1", draft.CreatedByUserId);
        Assert.Equal(Now, draft.CreatedAtUtc);
        Assert.Same(lines, draft.Lines);

        Assert.Null(PartyBillingDraftRules.NewDraft(
            statementId, "r", "a", PartyBillingPayeeType.Individual, null, 0m, "   ", "u", Now, []).Notes);
    }

    // ---- deferral leftovers ----

    [Fact]
    public void Only_same_kind_leftovers_are_deferred()
    {
        var survey = Ledger(Guid.NewGuid());
        var inspection = Ledger(Guid.NewGuid());
        var unknown = Ledger(Guid.NewGuid());
        var kinds = new Dictionary<Guid, WorkflowTaskKind>
        {
            [survey.WorkflowTaskId] = WorkflowTaskKind.EngineeringSurvey,
            [inspection.WorkflowTaskId] = WorkflowTaskKind.FieldInspection,
        };

        var leftovers = PartyBillingDraftRules.SameKindLeftovers(
            [survey, inspection, unknown],
            kinds,
            WorkflowTaskKind.EngineeringSurvey);

        Assert.Same(survey, Assert.Single(leftovers));
    }

    // ---- monthly vendor run ----

    [Fact]
    public void Monthly_run_groups_vendor_lines_by_assignee()
    {
        var groups = PartyBillingDraftRules.VendorReadyByAssignee(
        [
            Ready(PartyBillingPayeeType.Vendor, "eo-1", "t1"),
            Ready(PartyBillingPayeeType.Vendor, "eo-2", "t2"),
            Ready(PartyBillingPayeeType.Vendor, "eo-1", "t3"),
            Ready(PartyBillingPayeeType.Individual, "ins-1", "t4"),
            Ready(PartyBillingPayeeType.Vendor, null, "t5"),
        ]);

        Assert.Equal(["eo-1", "eo-2"], groups.Select(g => g.Key));
        Assert.Equal(["t1", "t3"], groups[0].Select(l => l.WorkflowTaskId));
    }

    [Fact]
    public void Monthly_run_notes_carry_the_month()
    {
        Assert.Equal(
            "مسير آلي — 2026-03",
            PartyBillingDraftRules.MonthRunNotes(new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void Monthly_run_response_reports_nothing_created_as_an_error()
    {
        var empty = PartyBillingDraftRules.MonthRunResponse([], 0);
        Assert.Equal("لم يُنشأ أي مسير — قد تكون المسيرات مفتوحة مسبقاً لنفس الشهر.", empty.Error);
        Assert.Equal(0, empty.AssigneesCovered);

        var created = PartyBillingDraftRules.MonthRunResponse(
            [new PartyBillingStatementDto(), new PartyBillingStatementDto()], 7);
        Assert.Null(created.Error);
        Assert.Equal(2, created.AssigneesCovered);
        Assert.Equal(7, created.LinesIncluded);
        Assert.Equal(2, created.Created.Count);
    }
}
