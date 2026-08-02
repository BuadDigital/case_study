using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Employee discounts skip the office-approval loop: the line becomes ready for finance and the
/// assignee is told. Disputed is not a state employees can enter.
/// </summary>
public class EmployeeDiscountPathTests
{
    [Fact]
    public async Task Applying_a_discount_to_an_employee_sends_the_line_to_finance()
    {
        await using var db = CreateDb();
        var taskId = SeedEmployeeLedger(db, InspectorFeeBillingStatus.SupReview);
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).PatchAsync(
            taskId,
            new PatchInspectorFeeRequest
            {
                SupervisorDiscountSar = 50m,
                DiscountReason = "تأخير تسليم",
            },
            canManageAllDepartments: true);

        var stored = await db.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, stored.BillingStatus);
        Assert.Equal(50m, stored.SupervisorDiscountSar);
        Assert.Equal("تأخير تسليم", stored.DiscountReason);
    }

    [Fact]
    public async Task An_employee_cannot_open_a_pricing_dispute()
    {
        await using var db = CreateDb();
        var taskId = SeedEmployeeLedger(db, InspectorFeeBillingStatus.OfficeReview, discount: 40m);
        await db.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db).TransitionAsync(
            taskId,
            new InspectorFeeTransitionRequest
            {
                Action = InspectorFeeActions.OfficeDispute,
                Reason = "اعتراض",
            },
            "office-user",
            actorAssigneeId: "insp-emp-1",
            isOperationsManager: false,
            isFinancialOfficer: false);

        Assert.Null(row);
        Assert.NotNull(error);
        Assert.Contains("الموظف", error);
        var stored = await db.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.OfficeReview, stored.BillingStatus);
    }

    [Fact]
    public void Authorization_rejects_dispute_actions_for_employees()
    {
        var ledger = new InspectorFeeLedger
        {
            InspectorType = InspectorFeeRules.TypeEmployee,
            AssigneeId = "insp-emp-1",
            BillingStatus = InspectorFeeBillingStatus.OfficeReview,
        };

        Assert.False(InspectorFeeTransitionAuthorization.CanPerformAction(
            InspectorFeeActions.OfficeDispute,
            ledger,
            "insp-emp-1",
            isOperationsManager: false,
            isFinancialOfficer: false));
        Assert.False(InspectorFeeTransitionAuthorization.CanPerformAction(
            InspectorFeeActions.ResolveDispute,
            ledger,
            null,
            isOperationsManager: true,
            isFinancialOfficer: false));
    }

    private static Guid SeedEmployeeLedger(
        ApplicationDbContext db,
        string status,
        decimal discount = 0m)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-EMP",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-EMP",
            AssigneeId = "insp-emp-1",
            InspectorType = InspectorFeeRules.TypeEmployee,
            SupervisingDepartment = SupervisingDepartments.Valuation,
            AgreedFeeSar = 400m,
            SupervisorDiscountSar = discount,
            DiscountReason = discount > 0 ? "حسم" : null,
            BillingStatus = status,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        return taskId;
    }

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"employee-discount-{Guid.NewGuid():N}")
            .Options);
}
