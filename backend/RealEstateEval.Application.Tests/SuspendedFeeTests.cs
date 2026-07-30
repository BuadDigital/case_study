using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A supervisor can withhold a party fee without deleting it. The amount stays on the row for the
/// record, but the line leaves every payable bucket until the suspension is lifted — and lifting it
/// returns the line exactly where it was withheld from.
/// </summary>
public class SuspendedFeeTests
{
    [Fact]
    public async Task Suspending_a_ready_line_takes_it_out_of_the_payable_total()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, InspectorFeeBillingStatus.AtFinance);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);

        var (row, error) = await service.TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.Suspend,
                Reason = "بانتظار تسوية مخالفة",
            },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Null(error);
        Assert.NotNull(row);
        Assert.Equal(InspectorFeeBillingStatus.Suspended, row!.BillingStatus);
        Assert.Equal("بانتظار تسوية مخالفة", row.SuspensionReason);

        var summary = await service.GetSummaryAsync(
            assigneeId: null,
            workflowTaskId: null,
            submittedOnly: false);
        Assert.Equal(0m, summary.AtFinanceSar);
        Assert.Equal(1_000m, summary.SuspendedSar);
    }

    [Fact]
    public async Task Suspending_without_a_reason_is_refused()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, InspectorFeeBillingStatus.AtFinance);
        await db.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest { Action = InspectorFeeActions.Suspend },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Null(row);
        Assert.NotNull(error);
        var stored = await db.InspectorFeeLedgers.AsNoTracking()
            .FirstAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, stored.BillingStatus);
    }

    /// <summary>
    /// Without a restore point a suspended draft would come back as ready for finance, skipping the
    /// supervisor approval it never received.
    /// </summary>
    [Theory]
    [InlineData(InspectorFeeBillingStatus.Draft)]
    [InlineData(InspectorFeeBillingStatus.SupReview)]
    [InlineData(InspectorFeeBillingStatus.AtFinance)]
    [InlineData(InspectorFeeBillingStatus.Deferred)]
    public async Task Lifting_a_suspension_restores_the_status_it_was_withheld_from(string original)
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, original);
        await db.SaveChangesAsync();
        var service = TestInspectorFeeServiceFactory.Create(db);

        await service.TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.Suspend,
                Reason = "إيقاف مؤقت",
            },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        var (row, error) = await service.TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest { Action = InspectorFeeActions.LiftSuspension },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Null(error);
        Assert.Equal(original, row!.BillingStatus);
        Assert.Null(row.SuspensionReason);
        var stored = await db.InspectorFeeLedgers.AsNoTracking()
            .FirstAsync(l => l.WorkflowTaskId == taskId);
        Assert.Null(stored.PreSuspensionStatus);
    }

    /// <summary>
    /// Once a line joins a statement the money is committed there, so it has to be pulled back through
    /// the statement rather than withheld behind the accountant's back.
    /// </summary>
    [Theory]
    [InlineData(InspectorFeeBillingStatus.InStatement)]
    [InlineData(InspectorFeeBillingStatus.DisbReq)]
    [InlineData(InspectorFeeBillingStatus.Disbursed)]
    public async Task A_committed_line_cannot_be_suspended(string status)
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, status);
        await db.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.Suspend,
                Reason = "محاولة إيقاف",
            },
            "supervisor-1",
            actorAssigneeId: null,
            isOperationsManager: true,
            isFinancialOfficer: false,
            actorDepartment: SupervisingDepartments.Valuation);

        Assert.Null(row);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Finance_cannot_suspend_a_line()
    {
        await using var db = CreateDb();
        var taskId = SeedLedger(db, InspectorFeeBillingStatus.AtFinance);
        await db.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.Suspend,
                Reason = "المحاسب يوقف",
            },
            "accountant-1",
            actorAssigneeId: null,
            isOperationsManager: false,
            isFinancialOfficer: true,
            actorDepartment: SupervisingDepartments.Finance);

        Assert.Null(row);
        Assert.NotNull(error);
    }

    /// <summary>
    /// The engineering billing statement reads ready and deferred lines only, so withholding one has
    /// to remove it from the eligible set rather than merely flag it.
    /// </summary>
    [Fact]
    public void A_suspended_line_is_not_eligible_for_a_statement() =>
        Assert.False(InspectorFeeBillingRules.IsReadyForEngStatement(
            InspectorFeeBillingStatus.Suspended));

    private static Guid SeedLedger(ApplicationDbContext db, string status)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-SUSP",
            now,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب",
            assigneeId: "office-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-SUSP",
            AssigneeId = "office-1",
            InspectorType = "متعاون شركة",
            SupervisingDepartment = SupervisingDepartments.Valuation,
            AgreedFeeSar = 1_000m,
            BillingStatus = status,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"fee-suspension-{Guid.NewGuid():N}")
            .Options);
}
