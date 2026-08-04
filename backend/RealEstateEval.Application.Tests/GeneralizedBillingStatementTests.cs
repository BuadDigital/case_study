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
