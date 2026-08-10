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
        db.UserProfiles.Add(new UserProfile
        {
            UserId = Guid.NewGuid().ToString("N"),
            DistributionAssigneeId = "gr-1",
            ContractType = ContractType.Freelance,
            RoleId = "government-reviewer",
            JobTitle = "مراجع حكومي",
            CreatedAtUtc = DateTime.UtcNow,
        });
        var task = GovernmentReviewTask("PO-PROV-1", "gr-1");
        db.WorkflowTasks.Add(task);
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).EnsureLedgersForTasksAsync([task]);

        var ledger = await db.InspectorFeeLedgers.SingleAsync();
        Assert.Equal(GovernmentRate, ledger.AgreedFeeSar);
        Assert.Equal(tableId, ledger.PricingTableId);
        Assert.Equal(SupervisingDepartments.CaseStudy, ledger.SupervisingDepartment);
        Assert.Equal("gr-1", ledger.UserId);
        Assert.NotEqual(Guid.Empty, ledger.Id);
    }

    /// <summary>
    /// Without a flat assignment and compensation flag, accrual must not invent a zero employee
    /// draft — that was the old hand-entry path.
    /// </summary>
    [Fact]
    public async Task An_employee_without_a_flat_table_does_not_open_a_ledger()
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

        Assert.Empty(await db.InspectorFeeLedgers.ToListAsync());
    }

    /// <summary>
    /// A flat-priced incentive keeps its table stamp. Hand override is refused so provenance cannot
    /// be erased by typing over the amount.
    /// </summary>
    [Fact]
    public async Task A_flat_priced_employee_fee_rejects_hand_override()
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

        var patched = await TestInspectorFeeServiceFactory.Create(db).PatchAsync(
            taskId,
            new PatchInspectorFeeRequest { AgreedFeeSar = 275m },
            canManageAllDepartments: true);

        Assert.Null(patched);
        var ledger = await db.InspectorFeeLedgers.SingleAsync();
        Assert.Equal(GovernmentRate, ledger.AgreedFeeSar);
        Assert.Equal(tableId, ledger.PricingTableId);
    }

    [Fact]
    public async Task An_engineering_accrual_refuses_when_the_table_has_no_price()
    {
        await using var db = CreateDb();
        var propertyId = Guid.NewGuid();
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = propertyId,
            WorkOrderId = Guid.NewGuid(),
            Area = "300",
        });
        // Placeholder survey table with no tiers — ResolveDefaultFeeAsync must fail closed.
        db.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = PartyFeePricingCategories.EngineeringSurvey,
            Name = "فارغ",
            IsActive = true,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        var task = WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-PROV-EMPTY",
            DateTime.UtcNow,
            status: WorkflowTaskStatus.Completed,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب هندسي",
            id: Guid.NewGuid(),
            assigneeId: "eng-office-empty",
            propertyId: propertyId);
        db.WorkflowTasks.Add(task);
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = task.Id,
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = propertyId,
            PoNumber = "PO-PROV-EMPTY",
            SubmittedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var (row, error) = await TestInspectorFeeServiceFactory.Create(db)
            .AccrueEngineeringSurveyFeeAsync(task.Id, "user-1");

        Assert.Null(row);
        Assert.Equal(PricingErrors.FeeUnresolved, error);
        Assert.Empty(db.InspectorFeeLedgers);
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
            Category = PartyFeePricingCategories.CourtVisit,
            Name = "اختبار",
            IsActive = true,
            CourtVisitFeeSar = rate,
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
