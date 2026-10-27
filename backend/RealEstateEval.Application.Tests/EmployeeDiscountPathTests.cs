using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A supervisor discount is final: the line becomes ready for finance and the party is told.
/// </summary>
public class EmployeeDiscountPathTests
{
    [Fact]
    public async Task Applying_a_discount_to_an_employee_sends_the_line_to_finance()
    {
        await using var db = CreateDb();
        var taskId = SeedEmployeeLedger(db, InspectorFeeBillingStatus.SupReview);
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db.CaseStudy).PatchAsync(
            taskId,
            new PatchInspectorFeeRequest
            {
                SupervisorDiscountSar = 50m,
                DiscountReason = "تأخير تسليم",
            },
            canManageAllDepartments: true);

        var stored = await db.Financial.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, stored.BillingStatus);
        Assert.Equal(50m, stored.SupervisorDiscountSar);
        Assert.Equal("تأخير تسليم", stored.DiscountReason);
    }

    /// <summary>
    /// The office-approval loop is gone: a supervisor discount on an engineering-office line is
    /// final and the line goes straight to finance, exactly like an employee's.
    /// </summary>
    [Fact]
    public async Task A_supervisor_discount_on_an_engineering_office_line_goes_straight_to_finance()
    {
        await using var db = CreateDb();
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-ENG",
            now,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب هندسي",
            assigneeId: "eng-office-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-ENG",
            AssigneeId = "eng-office-1",
            InspectorType = "متعاون شركة",
            AgreedFeeSar = 900m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.CaseStudy.SaveChangesAsync();
        await db.Financial.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db.CaseStudy).PatchAsync(
            taskId,
            new PatchInspectorFeeRequest
            {
                SupervisorDiscountSar = 100m,
                DiscountReason = "تأخّر تسليم التقرير المساحي",
            },
            canManageAllDepartments: true);

        var stored = await db.Financial.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, stored.BillingStatus);
        Assert.Equal(100m, stored.SupervisorDiscountSar);
    }

    private static Guid SeedEmployeeLedger(
        TestDatabases.ContextSet db,
        string status,
        decimal discount = 0m)
    {
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.CaseStudy.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-EMP",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        db.Financial.InspectorFeeLedgers.Add(new InspectorFeeLedger
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

    private static TestDatabases.ContextSet CreateDb() =>
        TestDatabases.Create("employee-discount");
}
