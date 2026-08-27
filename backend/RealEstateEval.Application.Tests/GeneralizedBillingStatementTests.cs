using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Attachments.Domain;
using RealEstateEval.Operations.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// billing statements cover field-inspection, engineering-survey, and court-visit fees.
/// </summary>
public class GeneralizedBillingStatementTests
{
    [Fact]
    public async Task CreateStatement_accepts_field_inspection_lines()
    {
        await using var db = CreateDb();
        var taskId = await SeedReadyLedgerAsync(db, WorkflowTaskKind.FieldInspection, "fi-1");
        var service = CreateStatementService(db);

        var result = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [taskId.ToString()],
            },
            "finance-1");

        Assert.Null(result.Error);
        Assert.NotNull(result.Statement);
        var ledger = await db.Financial.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync();
        Assert.Equal(InspectorFeeBillingStatus.InStatement, ledger.BillingStatus);
        Assert.NotNull(ledger.PartyBillingStatementId);
    }

    [Fact]
    public async Task CreateStatement_collapses_reassignment_twins_for_same_task_and_deed()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var taskId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-DUP",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "طرف",
            assigneeId: "fi-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));

 // Legacy UserId + current assignee twins (same task + property).
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-DUP",
            PropertyId = propertyId,
            DeedId = propertyId,
            UserId = "fi-legacy",
            AssigneeId = "fi-1",
            InspectorType = InspectorFeeRules.TypeCooperatorIndividual,
            AgreedFeeSar = 400m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now.AddHours(-2),
            CreatedAtUtc = now.AddHours(-2),
            UpdatedAtUtc = now.AddHours(-1),
        });
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-DUP",
            PropertyId = propertyId,
            DeedId = propertyId,
            UserId = "fi-1",
            AssigneeId = "fi-1",
            InspectorType = InspectorFeeRules.TypeCooperatorIndividual,
            AgreedFeeSar = 400m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var service = CreateStatementService(db);
        var ready = await service.ListReadyLinesAsync();
        Assert.Single(ready);
        Assert.Equal(taskId.ToString(), ready[0].WorkflowTaskId);

        var result = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [taskId.ToString()],
            },
            "finance-1");

        Assert.Null(result.Error);
        Assert.NotNull(result.Statement);
        Assert.Single(result.Statement!.Lines);
        var inStatement = await db.Financial.InspectorFeeLedgers.AsNoTracking()
            .Where(l => l.BillingStatus == InspectorFeeBillingStatus.InStatement)
            .ToListAsync();
        Assert.Single(inStatement);
        Assert.Equal("fi-1", inStatement[0].UserId);
    }

    [Fact]
    public async Task CreateStatement_rejects_when_workflow_task_already_on_a_statement_line()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var taskId = Guid.NewGuid();
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-PAID",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "طرف",
            assigneeId: "fi-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        var closedStatementId = Guid.NewGuid();
        db.Financial.PartyBillingStatements.Add(new PartyBillingStatement
        {
            Id = closedStatementId,
            ReferenceNumber = "FN-CS-000",
            AssigneeId = "fi-legacy",
            PayeeType = PartyBillingPayeeType.Individual,
            TaskKind = "field-inspection",
            Status = PartyBillingStatementStatus.Closed,
            TotalNetSar = 400m,
            CreatedByUserId = "fin",
            CreatedAtUtc = now.AddDays(-1),
            ClosedAtUtc = now.AddDays(-1),
        });
        db.Financial.PartyBillingStatementLines.Add(new PartyBillingStatementLine
        {
            Id = Guid.NewGuid(),
            StatementId = closedStatementId,
            WorkflowTaskId = taskId,
            NetFeeSar = 400m,
        });
 // Twin still looks "ready" in ledger table.
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-PAID",
            UserId = "fi-1",
            AssigneeId = "fi-1",
            InspectorType = InspectorFeeRules.TypeCooperatorIndividual,
            AgreedFeeSar = 400m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var service = CreateStatementService(db);
        var ready = await service.ListReadyLinesAsync();
        Assert.DoesNotContain(ready, l => l.WorkflowTaskId == taskId.ToString());

        var result = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [taskId.ToString()],
            },
            "finance-1");

        Assert.Contains("مُدرج مسبقاً", result.Error);
        Assert.Null(result.Statement);
    }

    [Fact]
    public async Task CreateStatement_rejects_mixed_task_kinds()
    {
        await using var db = CreateDb();
        var fieldId = await SeedReadyLedgerAsync(db, WorkflowTaskKind.FieldInspection, "fi-1");
        var engId = await SeedReadyLedgerAsync(db, WorkflowTaskKind.EngineeringSurvey, "eo-1");
        var service = CreateStatementService(db);

        var result = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [fieldId.ToString(), engId.ToString()],
            },
            "finance-1");

        Assert.Contains("نفس نوع المهمة", result.Error);
        Assert.Null(result.Statement);
    }

    [Fact]
    public async Task CreateStatement_accepts_court_visit_fee_charges()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var opsTaskId = Guid.NewGuid();
        var chargeId = Guid.NewGuid();
        db.Financial.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = chargeId,
            OperationsTaskId = opsTaskId,
            TaskDisplayId = "CV-1",
            PoNumber = "PO-CV",
            CreditAssigneeId = "gov-firas",
            CreditAssigneeName = "فراس",
            AmountSar = 350m,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var service = CreateStatementService(db);
        var ready = await service.ListReadyLinesAsync();
        Assert.Contains(ready, r => r.WorkflowTaskId == chargeId.ToString()
            && r.TaskKind == "court-visit"
            && r.PayeeType == PartyBillingPayeeType.Individual
            && r.NetFeeSar == 350m);

        var result = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [chargeId.ToString()],
            },
            "finance-1");

        Assert.Null(result.Error);
        Assert.NotNull(result.Statement);
        Assert.Equal("court-visit", result.Statement!.TaskKind);
        Assert.Equal(PartyBillingPayeeType.Individual, result.Statement.PayeeType);
        Assert.Equal(350m, result.Statement.TotalNetSar);

 // Once on a statement line, not ready again.
        var readyAfter = await service.ListReadyLinesAsync();
        Assert.DoesNotContain(readyAfter, r => r.WorkflowTaskId == chargeId.ToString());
    }

    [Fact]
    public async Task CloseStatement_settles_court_visit_fee_charges()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var chargeId = Guid.NewGuid();
        db.Financial.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = chargeId,
            OperationsTaskId = Guid.NewGuid(),
            TaskDisplayId = "CV-2",
            PoNumber = "PO-CV2",
            CreditAssigneeId = "gov-firas",
            CreditAssigneeName = "فراس",
            AmountSar = 200m,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        var receiptId = Guid.NewGuid();
        db.Attachments.FileAttachments.Add(new FileAttachment
        {
            Id = receiptId,
            Scope = "transfer-receipt",
            ScopeKey = "test",
            FileName = "r.pdf",
            ContentType = "application/pdf",
            SizeBytes = 10,
            StorageKey = "test/r.pdf",
            UploadedByUserId = "finance-1",
            CreatedAtUtc = now,
        });
        await db.Financial.SaveChangesAsync();
        await db.Attachments.SaveChangesAsync();

        var service = CreateStatementService(db);
        var created = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [chargeId.ToString()],
            },
            "finance-1");
        Assert.Null(created.Error);
        var statementId = Guid.Parse(created.Statement!.Id);

        var issued = await service.IssueStatementAsync(statementId, "finance-1");
        Assert.Null(issued.Error);

        var (closed, closeError) = await service.CloseStatementAsync(
            statementId,
            new ClosePartyBillingStatementRequest
            {
                DisbursementVoucher = "V-CV-1",
                TransferReference = "TR-CV-1",
                TransferReceiptAttachmentId = receiptId.ToString(),
            },
            "finance-1");
        Assert.Null(closeError);
        Assert.NotNull(closed);
        Assert.Equal(PartyBillingStatementStatus.Closed, closed!.Status);

        var charge = await db.Financial.CourtVisitFeeCharges.AsNoTracking()
            .SingleAsync(c => c.Id == chargeId);
        Assert.Equal(CourtVisitFeeStatuses.Settled, charge.Status);
    }

    [Fact]
    public async Task CreateStatement_rejects_mix_of_court_visit_and_ledger_line()
    {
        await using var db = CreateDb();
        var fieldId = await SeedReadyLedgerAsync(db, WorkflowTaskKind.FieldInspection, "fi-1");
        var now = DateTime.UtcNow;
        var chargeId = Guid.NewGuid();
        db.Financial.CourtVisitFeeCharges.Add(new CourtVisitFeeCharge
        {
            Id = chargeId,
            OperationsTaskId = Guid.NewGuid(),
            TaskDisplayId = "CV-M",
            CreditAssigneeId = "gov-firas",
            CreditAssigneeName = "فراس",
            AmountSar = 100m,
            Status = CourtVisitFeeStatuses.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        var service = CreateStatementService(db);
        var result = await service.CreateStatementAsync(
            new CreatePartyBillingStatementRequest
            {
                WorkflowTaskIds = [fieldId.ToString(), chargeId.ToString()],
            },
            "finance-1");

        Assert.Contains("لا تُخلط", result.Error);
        Assert.Null(result.Statement);
    }

    [Fact]
    public async Task CreateDisbursementRequest_is_blocked_for_field_inspection()
    {
        await using var db = CreateDb();
        var taskId = await SeedReadyLedgerAsync(db, WorkflowTaskKind.FieldInspection, "fi-1");

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db.CaseStudy).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.CreateDisbursementRequest,
            },
            "fi-user",
            actorAssigneeId: "fi-1",
            isOperationsManager: false,
            isFinancialOfficer: false);

        Assert.Null(row);
        Assert.Contains("كشف الأطراف", error);
    }

    private static async Task<Guid> SeedReadyLedgerAsync(
        TestDatabases.ContextSet db,
        WorkflowTaskKind kind,
        string assigneeId)
    {
        var now = DateTime.UtcNow;
        var taskId = Guid.NewGuid();
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            kind,
            "PO-STMT",
            now,
            assigneeRole: kind == WorkflowTaskKind.EngineeringSurvey
                ? "engineering-office"
                : "field-inspector",
            assigneeName: "طرف",
            assigneeId: assigneeId,
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-STMT",
            AssigneeId = assigneeId,
            InspectorType = kind == WorkflowTaskKind.EngineeringSurvey
                ? EngineeringSurveyFeeRules.OfficePartyType
                : InspectorFeeRules.TypeCooperatorIndividual,
            AgreedFeeSar = 500m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();
        return taskId;
    }

    private static PartyBillingStatementService CreateStatementService(TestDatabases.ContextSet db)
    {
        var attachments = TestInspectorFeeServiceFactory.ShareAttachmentLookup(db.Attachments);
        var visitFees = new OperationsTaskVisitFeeHelper(
            db.Operations,
            new CourtVisitFeeChargeService(db.Financial),
            new IdentityDirectory(db.Identity),
            new PartyFeePricingService(db.Financial));
        return new(
            db.Financial,
            new CaseStudyLookup(db.CaseStudy),
            new CaseStudyCommands(db.CaseStudy),
            attachments,
            new NullNotificationService(),
            TestInspectorFeeServiceFactory.CreateRecipients(db.CaseStudy),
            visitFees,
            NullLogger<PartyBillingStatementService>.Instance);
    }

    private static TestDatabases.ContextSet CreateDb() =>
        TestDatabases.Create("stmt-gen");

    private sealed class NullNotificationService : INotificationService
    {
        public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

        public Task<UserNotificationDto> CreateForUserAsync(
            string userId,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserNotificationDto { Title = request.Title });

        public Task<int> CreateForUsersAsync(
            IReadOnlyCollection<string> userIds,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(0);

        public Task<bool> MarkReadAsync(
            string userId,
            Guid id,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task<bool> DeleteAsync(
            string userId,
            Guid id,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
