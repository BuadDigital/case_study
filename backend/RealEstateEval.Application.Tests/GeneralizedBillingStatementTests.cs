using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// ج٩: billing statements cover field-inspection and government-review, not only engineering survey.
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
        var ledger = await db.InspectorFeeLedgers.SingleAsync();
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
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-DUP",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "طرف",
            assigneeId: "fi-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));

        // Legacy UserId + current assignee twins (same task + property).
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
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
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
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
        await db.SaveChangesAsync();

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
        var inStatement = await db.InspectorFeeLedgers
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
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-PAID",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "طرف",
            assigneeId: "fi-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        var closedStatementId = Guid.NewGuid();
        db.PartyBillingStatements.Add(new PartyBillingStatement
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
        db.PartyBillingStatementLines.Add(new PartyBillingStatementLine
        {
            Id = Guid.NewGuid(),
            StatementId = closedStatementId,
            WorkflowTaskId = taskId,
            NetFeeSar = 400m,
        });
        // Twin still looks "ready" in ledger table.
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
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
        await db.SaveChangesAsync();

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
    public async Task CreateDisbursementRequest_is_blocked_for_field_inspection()
    {
        await using var db = CreateDb();
        var taskId = await SeedReadyLedgerAsync(db, WorkflowTaskKind.FieldInspection, "fi-1");

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db).TransitionAsync(
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
        ApplicationDbContext db,
        WorkflowTaskKind kind,
        string assigneeId)
    {
        var now = DateTime.UtcNow;
        var taskId = Guid.NewGuid();
        db.WorkflowTasks.Add(WorkflowTask.Create(
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
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
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
        await db.SaveChangesAsync();
        return taskId;
    }

    private static PartyBillingStatementService CreateStatementService(ApplicationDbContext db) =>
        new(
            db,
            new NullNotificationService(),
            TestInspectorFeeServiceFactory.CreateRecipients(db),
            NullLogger<PartyBillingStatementService>.Instance);

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"stmt-gen-{Guid.NewGuid():N}")
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

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
