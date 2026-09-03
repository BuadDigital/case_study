using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

public class PartyBillingStatementRulesTests
{
    private static InspectorFeeLedger Ledger(
        Guid taskId,
        string assigneeId = "vendor-1",
        string status = InspectorFeeBillingStatus.AtFinance,
        decimal fee = 100m,
        decimal discount = 0m,
        bool excluded = false,
        Guid? statementId = null) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = taskId,
            AssigneeId = assigneeId,
            UserId = assigneeId,
            BillingStatus = status,
            AgreedFeeSar = fee,
            SupervisorDiscountSar = discount,
            ExcludedFromBatch = excluded,
            PartyBillingStatementId = statementId,
            CreatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAtUtc = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc),
        };

    private static Dictionary<Guid, WorkflowTaskKind> Kinds(
        params (Guid Id, WorkflowTaskKind Kind)[] entries) =>
        entries.ToDictionary(e => e.Id, e => e.Kind);

    // ---- selection plan ----

    [Fact]
    public void Plan_rejects_a_task_with_no_ledger()
    {
        var missing = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [missing],
            [],
            [],
            Kinds((missing, WorkflowTaskKind.EngineeringSurvey)));

        Assert.Equal("بعض البنود المحددة غير موجودة في سجل الأتعاب.", plan.Error);
    }

    [Fact]
    public void Plan_rejects_a_task_already_on_a_statement_line()
    {
        var task = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [task],
            [Ledger(task)],
            [task],
            Kinds((task, WorkflowTaskKind.EngineeringSurvey)));

        Assert.Equal("أحد البنود مُدرج مسبقاً في مسير صرف (مدفوع أو قائم).", plan.Error);
    }

    [Theory]
    [InlineData(InspectorFeeBillingStatus.Draft)]
    [InlineData(InspectorFeeBillingStatus.InStatement)]
    public void Plan_rejects_ledgers_that_are_not_ready(string status)
    {
        var task = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [task],
            [Ledger(task, status: status)],
            [],
            Kinds((task, WorkflowTaskKind.EngineeringSurvey)));

        Assert.Equal("لا يُدرج في كشف الفوترة إلا البنود الجاهزة أو المرحَّلة.", plan.Error);
    }

    [Fact]
    public void Plan_rejects_excluded_and_already_bound_ledgers()
    {
        var excludedTask = Guid.NewGuid();
        var boundTask = Guid.NewGuid();

        Assert.NotNull(PartyBillingStatementRules.BuildLedgerStatementPlan(
            [excludedTask],
            [Ledger(excludedTask, excluded: true)],
            [],
            Kinds((excludedTask, WorkflowTaskKind.EngineeringSurvey))).Error);

        Assert.NotNull(PartyBillingStatementRules.BuildLedgerStatementPlan(
            [boundTask],
            [Ledger(boundTask, statementId: Guid.NewGuid())],
            [],
            Kinds((boundTask, WorkflowTaskKind.EngineeringSurvey))).Error);
    }

    [Fact]
    public void Plan_rejects_a_kind_that_is_not_a_statement_kind()
    {
        var task = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [task],
            [Ledger(task)],
            [],
            Kinds((task, WorkflowTaskKind.CaseStudyProperty)));

        Assert.StartsWith("كشف الفوترة يقبل بنود المعاينة", plan.Error);
    }

    [Fact]
    public void Plan_rejects_a_missing_kind_lookup()
    {
        var task = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [task],
            [Ledger(task)],
            [],
            Kinds());

        Assert.StartsWith("كشف الفوترة يقبل بنود المعاينة", plan.Error);
    }

    [Fact]
    public void Plan_rejects_mixed_kinds()
    {
        var survey = Guid.NewGuid();
        var inspection = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [survey, inspection],
            [Ledger(survey), Ledger(inspection)],
            [],
            Kinds(
                (survey, WorkflowTaskKind.EngineeringSurvey),
                (inspection, WorkflowTaskKind.FieldInspection)));

        Assert.Equal("يجب أن تكون كل بنود الكشف من نفس نوع المهمة.", plan.Error);
    }

    [Fact]
    public void Plan_rejects_two_parties()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [a, b],
            [Ledger(a, "vendor-1"), Ledger(b, "vendor-2")],
            [],
            Kinds(
                (a, WorkflowTaskKind.EngineeringSurvey),
                (b, WorkflowTaskKind.EngineeringSurvey)));

        Assert.Equal("يجب أن تكون كل بنود الكشف لنفس الطرف.", plan.Error);
    }

    [Fact]
    public void Plan_groups_multi_deed_ledgers_into_one_line_per_task()
    {
        var task = Guid.NewGuid();
        var first = Ledger(task, fee: 100m, discount: 10m);
        first.PropertyId = Guid.NewGuid();
        var second = Ledger(task, fee: 60m);
        second.PropertyId = Guid.NewGuid();

        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [task],
            [first, second],
            [],
            Kinds((task, WorkflowTaskKind.EngineeringSurvey)));

        Assert.Null(plan.Error);
        Assert.Equal("vendor-1", plan.AssigneeId);
        Assert.Equal(WorkflowTaskKind.EngineeringSurvey, plan.StatementKind);
        var group = Assert.Single(plan.Groups);
        Assert.Equal(task, group.Key);
        Assert.Equal(2, group.Value.Count);
        Assert.Equal(150m, PartyBillingStatementRules.NetForGroup(group.Value));
    }

    [Fact]
    public void Deferred_ledgers_are_still_ready_for_a_statement()
    {
        var task = Guid.NewGuid();
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            [task],
            [Ledger(task, status: InspectorFeeBillingStatus.Deferred)],
            [],
            Kinds((task, WorkflowTaskKind.EngineeringSurvey)));

        Assert.Null(plan.Error);
    }

    // ---- court visit ----

    [Theory]
    [InlineData(0, 2, false)]
    [InlineData(2, 2, false)]
    [InlineData(1, 2, true)]
    public void Court_visit_charges_are_never_mixed_with_ledger_dues(
        int openCharges,
        int selected,
        bool expectError)
    {
        var error = PartyBillingStatementRules.ValidateCourtVisitMix(openCharges, selected);
        Assert.Equal(expectError, error is not null);
    }

    [Fact]
    public void Court_visit_selection_needs_one_payee_and_no_prior_line()
    {
        var charges = new List<CourtVisitFeeCharge>
        {
            new() { Id = Guid.NewGuid(), CreditAssigneeId = "emp-1", AmountSar = 200m },
            new() { Id = Guid.NewGuid(), CreditAssigneeId = "emp-1", AmountSar = 300m },
        };

        var (error, assignee) =
            PartyBillingStatementRules.ValidateCourtVisitSelection(charges, []);
        Assert.Null(error);
        Assert.Equal("emp-1", assignee);

        charges[1].CreditAssigneeId = "emp-2";
        Assert.Equal(
            "يجب أن تكون كل بنود زيارة المحكمة لنفس المستحق.",
            PartyBillingStatementRules.ValidateCourtVisitSelection(charges, []).Error);

        Assert.Equal(
            "أحد بنود زيارة المحكمة مُدرج مسبقاً في مسير صرف (مدفوع أو قائم).",
            PartyBillingStatementRules.ValidateCourtVisitSelection(charges, [Guid.NewGuid()]).Error);
    }

    // ---- transitions ----

    [Theory]
    [InlineData(PartyBillingStatementStatus.Draft, 1, null)]
    [InlineData(PartyBillingStatementStatus.Draft, 0, "لا يمكن إرسال مستند بلا بنود.")]
    [InlineData(PartyBillingStatementStatus.Issued, 1, "لا يمكن إرسال إلا المسيرات/الأوامر في حالة المسودة.")]
    public void Issue_needs_a_draft_with_lines(string status, int lineCount, string? expected)
    {
        Assert.Equal(expected, PartyBillingStatementRules.ValidateIssue(status, lineCount));
    }

    private static ClosePartyBillingStatementRequest CloseRequest(
        string voucher = "V-1",
        string transfer = "T-1",
        string? receipt = null) => new()
        {
            DisbursementVoucher = voucher,
            TransferReference = transfer,
            TransferReceiptAttachmentId = receipt ?? Guid.NewGuid().ToString(),
        };

    [Fact]
    public void Vendor_close_requires_a_received_and_matched_invoice()
    {
        var statement = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Vendor,
            Status = PartyBillingStatementStatus.Issued,
        };
        Assert.Equal(
            "لا يُصرف للمورّد إلا بعد ورود الفاتورة ومطابقتها.",
            PartyBillingStatementRules.ValidateClose(statement, CloseRequest()).Error);

        statement.Status = PartyBillingStatementStatus.InvoiceReceived;
        Assert.Equal(
            "أقر مطابقة الفاتورة قبل توثيق الصرف.",
            PartyBillingStatementRules.ValidateClose(statement, CloseRequest()).Error);

        statement.VendorInvoiceMatchedAtUtc = DateTime.UtcNow;
        var ok = PartyBillingStatementRules.ValidateClose(statement, CloseRequest());
        Assert.Null(ok.Error);
        Assert.False(ok.PromoteDraftToIssued);
    }

    [Fact]
    public void Individual_close_promotes_a_draft_to_issued()
    {
        var statement = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Individual,
            Status = PartyBillingStatementStatus.Draft,
        };

        var check = PartyBillingStatementRules.ValidateClose(statement, CloseRequest());
        Assert.Null(check.Error);
        Assert.True(check.PromoteDraftToIssued);
        Assert.Equal("V-1", check.Voucher);
        Assert.Equal("T-1", check.TransferReference);
        Assert.NotEqual(Guid.Empty, check.ReceiptAttachmentId);
    }

    [Fact]
    public void Individual_close_rejects_a_closed_statement()
    {
        var statement = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Individual,
            Status = PartyBillingStatementStatus.Closed,
        };
        Assert.Equal(
            "لا يُصرف للفرد إلا من أمر صرف صادر أو مُعد.",
            PartyBillingStatementRules.ValidateClose(statement, CloseRequest()).Error);
    }

    [Fact]
    public void Close_requires_voucher_transfer_and_a_parsable_receipt()
    {
        var statement = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Individual,
            Status = PartyBillingStatementStatus.Issued,
        };

        Assert.Equal(
            "رقم سند الصرف مطلوب.",
            PartyBillingStatementRules.ValidateClose(statement, CloseRequest(voucher: "  ")).Error);
        Assert.Equal(
            "مرجع التحويل مطلوب.",
            PartyBillingStatementRules.ValidateClose(statement, CloseRequest(transfer: " ")).Error);
        Assert.Equal(
            "إيصال التحويل (مرفق) مطلوب.",
            PartyBillingStatementRules.ValidateClose(statement, CloseRequest(receipt: "not-a-guid")).Error);
    }

    [Fact]
    public void Close_falls_back_to_the_legacy_external_invoice_number()
    {
        var statement = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Individual,
            Status = PartyBillingStatementStatus.Issued,
        };
        var request = new ClosePartyBillingStatementRequest
        {
            DisbursementVoucher = null!,
            TransferReference = "T-9",
            TransferReceiptAttachmentId = Guid.NewGuid().ToString(),
            ExternalInvoiceNumber = "LEGACY-7",
        };

        Assert.Equal("LEGACY-7", PartyBillingStatementRules.ValidateClose(statement, request).Voucher);
    }

    [Fact]
    public void External_invoice_on_close_prefers_the_vendor_invoice()
    {
        var vendor = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Vendor,
            VendorInvoiceNumber = "INV-3",
        };
        Assert.Equal("INV-3", PartyBillingStatementRules.ExternalInvoiceOnClose(vendor, "V-1"));

        vendor.VendorInvoiceNumber = null;
        Assert.Equal("V-1", PartyBillingStatementRules.ExternalInvoiceOnClose(vendor, "V-1"));

        var individual = new PartyBillingStatement
        {
            PayeeType = PartyBillingPayeeType.Individual,
            VendorInvoiceNumber = "INV-3",
        };
        Assert.Equal("V-1", PartyBillingStatementRules.ExternalInvoiceOnClose(individual, "V-1"));
    }

    [Fact]
    public void Cancel_is_blocked_after_close_cancel_or_invoice_match()
    {
        Assert.Equal(
            "لا يمكن إلغاء مستند مغلق أو ملغى.",
            PartyBillingStatementRules.ValidateCancel(
                PartyBillingStatementStatus.Closed, null, "سبب").Error);
        Assert.Equal(
            "لا يمكن إلغاء مستند مغلق أو ملغى.",
            PartyBillingStatementRules.ValidateCancel(
                PartyBillingStatementStatus.Cancelled, null, "سبب").Error);
        Assert.Equal(
            "لا يُلغى مسير بعد مطابقة فاتورة — استخدم الإعادة أو أكمل الصرف.",
            PartyBillingStatementRules.ValidateCancel(
                PartyBillingStatementStatus.InvoiceReceived, DateTime.UtcNow, "سبب").Error);
    }

    [Fact]
    public void Cancel_needs_a_reason_of_three_characters()
    {
        Assert.Equal(
            "سبب الإلغاء إلزامي.",
            PartyBillingStatementRules.ValidateCancel(
                PartyBillingStatementStatus.Issued, null, " ا ").Error);

        var (error, reason) = PartyBillingStatementRules.ValidateCancel(
            PartyBillingStatementStatus.Issued, null, "  خطأ إدخال  ");
        Assert.Null(error);
        Assert.Equal("خطأ إدخال", reason);
    }

    [Fact]
    public void Defer_only_accepts_an_existing_ready_statement_kind_line()
    {
        Assert.Equal("البند غير موجود.", PartyBillingStatementRules.DeferLineError(null, true));
        Assert.Equal(
            "الترحيل لمسار صرف المستحقين فقط.",
            PartyBillingStatementRules.DeferLineError(Ledger(Guid.NewGuid()), false));
        Assert.Equal(
            "لا يمكن ترحيل إلا البنود الجاهزة للصرف.",
            PartyBillingStatementRules.DeferLineError(
                Ledger(Guid.NewGuid(), status: InspectorFeeBillingStatus.Deferred), true));
        Assert.Null(PartyBillingStatementRules.DeferLineError(Ledger(Guid.NewGuid()), true));
    }

    // ---- projection ----

    [Fact]
    public void Property_labels_prefer_request_number_then_deed_then_id_and_append_district()
    {
        var byRequest = new CaseStudyPropertySnapshotDto
        {
            Id = Guid.NewGuid(),
            RequestNumber = " R-1 ",
            DeedNumber = "D-1",
            District = " النرجس ",
        };
        var byDeed = new CaseStudyPropertySnapshotDto
        {
            Id = Guid.NewGuid(),
            DeedNumber = " D-2 ",
            District = "",
        };
        var byId = new CaseStudyPropertySnapshotDto { Id = Guid.NewGuid() };

        var labels = PartyBillingStatementRules.PropertyLabels([byRequest, byDeed, byId]);

        Assert.Equal("R-1 — النرجس", labels[byRequest.Id]);
        Assert.Equal("D-2", labels[byDeed.Id]);
        Assert.Equal(byId.Id.ToString()[..8], labels[byId.Id]);
    }

    [Theory]
    [InlineData(
        CourtVisitFeeStatuses.Settled,
        PartyBillingStatementStatus.Issued,
        InspectorFeeBillingStatus.Disbursed)]
    [InlineData(
        CourtVisitFeeStatuses.Open,
        PartyBillingStatementStatus.Closed,
        InspectorFeeBillingStatus.Disbursed)]
    [InlineData(
        CourtVisitFeeStatuses.Open,
        PartyBillingStatementStatus.Cancelled,
        InspectorFeeBillingStatus.AtFinance)]
    [InlineData(
        CourtVisitFeeStatuses.Open,
        PartyBillingStatementStatus.Draft,
        InspectorFeeBillingStatus.InStatement)]
    public void Court_visit_line_status_follows_charge_then_statement(
        string chargeStatus,
        string statementStatus,
        string expected)
    {
        Assert.Equal(
            expected,
            PartyBillingStatementRules.CourtVisitLineStatus(chargeStatus, statementStatus));
    }

    [Fact]
    public void Resolve_ledger_prefers_the_row_bound_to_the_statement()
    {
        var statementId = Guid.NewGuid();
        var task = Guid.NewGuid();
        var loose = Ledger(task);
        var bound = Ledger(task, statementId: statementId);

        Assert.Same(bound, PartyBillingStatementRules.ResolveLedger(statementId, task, [loose, bound]));
        Assert.NotNull(PartyBillingStatementRules.ResolveLedger(Guid.NewGuid(), task, [loose, bound]));
        Assert.Null(PartyBillingStatementRules.ResolveLedger(statementId, Guid.NewGuid(), [loose]));
    }

    [Fact]
    public void Map_statements_projects_ledger_and_court_visit_lines()
    {
        var statementId = Guid.NewGuid();
        var ledgerTask = Guid.NewGuid();
        var chargeId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();

        var statement = new PartyBillingStatement
        {
            Id = statementId,
            ReferenceNumber = "PB-1",
            AssigneeId = "vendor-1",
            PayeeType = "",
            Status = PartyBillingStatementStatus.Draft,
            TotalNetSar = 500m,
        };
        var lines = new List<PartyBillingStatementLine>
        {
            new() { Id = Guid.NewGuid(), StatementId = statementId, WorkflowTaskId = ledgerTask, NetFeeSar = 200m },
            new() { Id = Guid.NewGuid(), StatementId = statementId, WorkflowTaskId = chargeId, NetFeeSar = 300m },
        };
        var ledger = Ledger(ledgerTask, status: InspectorFeeBillingStatus.InStatement);
        ledger.PropertyId = propertyId;
        ledger.PoNumber = "PO-9";
        var charge = new CourtVisitFeeCharge
        {
            Id = chargeId,
            TaskDisplayId = " CV-4 ",
            PoNumber = "PO-8",
            Status = CourtVisitFeeStatuses.Open,
        };

        var mapped = PartyBillingStatementRules.MapStatements(
            [statement],
            lines,
            [ledger],
            [charge],
            new Dictionary<Guid, string> { [propertyId] = "R-1 — النرجس" });

        var dto = Assert.Single(mapped);
        // Blank payee type defaults to vendor for display.
        Assert.Equal(PartyBillingPayeeType.Vendor, dto.PayeeType);
        Assert.Equal(2, dto.Lines.Count);

        var ledgerLine = dto.Lines.Single(l => l.WorkflowTaskId == ledgerTask.ToString());
        Assert.Equal("R-1 — النرجس", ledgerLine.PropertyLabel);
        Assert.Equal("PO-9", ledgerLine.PoNumber);
        Assert.Equal(InspectorFeeBillingStatus.InStatement, ledgerLine.BillingStatus);

        var chargeLine = dto.Lines.Single(l => l.WorkflowTaskId == chargeId.ToString());
        Assert.Equal("CV-4", chargeLine.PropertyLabel);
        Assert.Null(chargeLine.PropertyId);
        Assert.Equal(InspectorFeeBillingStatus.InStatement, chargeLine.BillingStatus);
    }

    [Fact]
    public void Map_statements_falls_back_to_the_property_ordinal_without_a_label()
    {
        var statementId = Guid.NewGuid();
        var task = Guid.NewGuid();
        var ledger = Ledger(task);
        ledger.PropertyOrdinal = 3;

        var mapped = PartyBillingStatementRules.MapStatements(
            [new PartyBillingStatement { Id = statementId, Status = PartyBillingStatementStatus.Draft }],
            [new PartyBillingStatementLine { Id = Guid.NewGuid(), StatementId = statementId, WorkflowTaskId = task }],
            [ledger],
            [],
            new Dictionary<Guid, string>());

        Assert.Equal("3", Assert.Single(mapped).Lines[0].PropertyLabel);
    }

    // ---- small helpers ----

    [Fact]
    public void Notes_are_trimmed_or_dropped()
    {
        Assert.Null(PartyBillingStatementRules.NormalizeNotes("   "));
        Assert.Null(PartyBillingStatementRules.NormalizeNotes(null));
        Assert.Equal("ملاحظة", PartyBillingStatementRules.NormalizeNotes("  ملاحظة  "));
    }

    [Fact]
    public void Month_start_is_the_utc_first_of_the_month()
    {
        var start = PartyBillingStatementRules.MonthStart(
            new DateTime(2026, 3, 17, 9, 30, 0, DateTimeKind.Utc));
        Assert.Equal(new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(DateTimeKind.Utc, start.Kind);
    }

    [Fact]
    public void One_ready_row_per_task_keeps_the_newest_ledger()
    {
        var task = Guid.NewGuid();
        var older = Ledger(task);
        older.UpdatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var newer = Ledger(task);
        newer.UpdatedAtUtc = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);

        var picked = PartyBillingStatementRules.PickOneLedgerPerTask([older, newer]);
        Assert.Same(newer, Assert.Single(picked));
    }

    [Fact]
    public void Ready_lines_are_ordered_newest_touched_first()
    {
        var a = new PartyBillingReadyLineDto
        {
            WorkflowTaskId = "a",
            UpdatedAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        var b = new PartyBillingReadyLineDto
        {
            WorkflowTaskId = "b",
            AccruedAtUtc = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        var c = new PartyBillingReadyLineDto { WorkflowTaskId = "c" };

        var ordered = PartyBillingStatementRules.OrderReadyLines([a, b, c]);
        Assert.Equal(["b", "a", "c"], ordered.Select(l => l.WorkflowTaskId));
    }
}
