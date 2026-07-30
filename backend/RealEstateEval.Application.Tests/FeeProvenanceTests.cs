using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A stored amount says nothing about where it came from. Every fee written from a pricing table
/// therefore carries the id of that table, so a rate that changes tomorrow cannot make yesterday's
/// billing unexplainable — and a fee entered by hand is visibly not from a table at all.
/// </summary>
public class FeeProvenanceTests
{
    private const decimal GovernmentRate = 350m;
    private const decimal SurveyRate = 1200m;

    [Fact]
    public async Task A_ledger_priced_from_the_table_records_which_table_it_was()
    {
        await using var db = CreateDb();
        var tableId = await SetGovernmentRateAsync(db, GovernmentRate);
        var task = GovernmentReviewTask("PO-PROV-1", "gr-1");
        db.WorkflowTasks.Add(task);
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).EnsureLedgersForTasksAsync([task]);

        var ledger = await db.InspectorFeeLedgers.SingleAsync();
        Assert.Equal(GovernmentRate, ledger.AgreedFeeSar);
        Assert.Equal(tableId, ledger.PricingTableId);
        Assert.Equal(SupervisingDepartments.CaseStudy, ledger.SupervisingDepartment);
    }

    /// <summary>
    /// An employee's fee is negotiated case by case and typed in later, so the ledger opens at zero
    /// with no table behind it. Naming one would claim a rate the table never gave.
    /// </summary>
    [Fact]
    public async Task An_employee_ledger_names_no_table_because_none_priced_it()
    {
        await using var db = CreateDb();
        await SetGovernmentRateAsync(db, GovernmentRate);
        var task = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-PROV-2",
            DateTime.UtcNow,
            assigneeRole: "field-inspector",
            assigneeName: "موظف",
            id: Guid.NewGuid());
        db.WorkflowTasks.Add(task);
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).EnsureLedgersForTasksAsync([task]);

        var ledger = await db.InspectorFeeLedgers.SingleAsync();
        Assert.Equal(0m, ledger.AgreedFeeSar);
        Assert.Null(ledger.PricingTableId);
        Assert.Equal(SupervisingDepartments.Valuation, ledger.SupervisingDepartment);
    }

    /// <summary>
    /// Typing an amount in replaces whatever the table said, so the ledger stops crediting the table
    /// for a figure it did not produce.
    /// </summary>
    [Fact]
    public async Task Entering_a_fee_by_hand_drops_the_table_it_used_to_name()
    {
        await using var db = CreateDb();
        var tableId = await SetGovernmentRateAsync(db, GovernmentRate);
        var now = DateTime.UtcNow;
        var taskId = Guid.NewGuid();
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-PROV-4",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "موظف",
            id: taskId));
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-PROV-4",
            InspectorType = InspectorFeeRules.TypeEmployee,
            AgreedFeeSar = GovernmentRate,
            PricingTableId = tableId,
            BillingStatus = InspectorFeeBillingStatus.Draft,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).PatchAsync(
            taskId,
            new PatchInspectorFeeRequest { AgreedFeeSar = 275m },
            canManageAllDepartments: true);

        var ledger = await db.InspectorFeeLedgers.SingleAsync();
        Assert.Equal(275m, ledger.AgreedFeeSar);
        Assert.Null(ledger.PricingTableId);
    }

    /// <summary>
    /// Survey fees come from an area schedule that offices renegotiate, which makes the accrual the
    /// place where provenance matters most.
    /// </summary>
    [Fact]
    public async Task An_engineering_accrual_records_the_table_behind_the_tier()
    {
        await using var db = CreateDb();
        var tableId = await SetSurveyTierAsync(db, "eng-office-1", SurveyRate);
        var propertyId = Guid.NewGuid();
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = propertyId,
            WorkOrderId = Guid.NewGuid(),
            Area = "300",
        });
        var task = WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-PROV-3",
            DateTime.UtcNow,
            status: WorkflowTaskStatus.Completed,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب هندسي",
            id: Guid.NewGuid(),
            assigneeId: "eng-office-1",
            propertyId: propertyId);
        db.WorkflowTasks.Add(task);
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = task.Id,
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = propertyId,
            PoNumber = "PO-PROV-3",
            SubmittedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db)
            .AccrueEngineeringSurveyFeeAsync(task.Id, "user-1");

        Assert.Null(error);
        Assert.NotNull(row);
        var ledger = await db.InspectorFeeLedgers.SingleAsync();
        Assert.Equal(SurveyRate, ledger.AgreedFeeSar);
        Assert.Equal(tableId, ledger.PricingTableId);
    }

    private static WorkflowTask GovernmentReviewTask(string poNumber, string assigneeId) =>
        WorkflowTask.Create(
            WorkflowTaskKind.GovernmentReview,
            poNumber,
            DateTime.UtcNow,
            assigneeRole: "government-reviewer",
            assigneeName: "مراجع",
            id: Guid.NewGuid(),
            assigneeId: assigneeId);

    private static async Task<Guid> SetGovernmentRateAsync(ApplicationDbContext db, decimal rate)
    {
        var tableId = Guid.NewGuid();
        db.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = tableId,
            Category = PartyFeePricingCategories.GovernmentReview,
            Name = "اختبار",
            IsActive = true,
            GovernmentReviewFeeSar = rate,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        return tableId;
    }

    /// <summary>
    /// Survey tables only answer for offices assigned to them, so the assignment is part of the
    /// fixture rather than an afterthought.
    /// </summary>
    private static async Task<Guid> SetSurveyTierAsync(
        ApplicationDbContext db,
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
        return tableId;
    }

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"fee-provenance-{Guid.NewGuid():N}")
            .Options);
}
