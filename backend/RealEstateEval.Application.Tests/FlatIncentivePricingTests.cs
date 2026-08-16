using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Employee incentives come from a flat table assigned to the person, not from a hand PATCH and not
/// from the cooperator party-rate columns on the category default.
/// </summary>
public class FlatIncentivePricingTests
{
    [Fact]
    public async Task An_assigned_flat_table_prices_an_employee_at_accrual()
    {
        await using var store = new TestInspectorFeeServiceFactory.Store("flat-incentive");
        await SeedFlatAssignmentAsync(store, amount: 350m, hasCompensation: true);
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var task = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FLAT",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed);
        store.App.WorkflowTasks.Add(task);
        await store.App.SaveChangesAsync();

        await store.Fees().EnsureLedgersForTasksAsync([task]);

        var ledger = await store.App.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(350m, ledger.AgreedFeeSar);
        Assert.NotNull(ledger.PricingTableId);
        Assert.Equal(InspectorFeeBillingStatus.Draft, ledger.BillingStatus);
    }

    [Fact]
    public async Task Without_compensation_no_employee_ledger_is_opened()
    {
        await using var store = new TestInspectorFeeServiceFactory.Store("flat-incentive");
        await SeedFlatAssignmentAsync(store, amount: 350m, hasCompensation: false);
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var task = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FLAT",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed);
        store.App.WorkflowTasks.Add(task);
        await store.App.SaveChangesAsync();

        await store.Fees().EnsureLedgersForTasksAsync([task]);

        Assert.False(await store.App.InspectorFeeLedgers.AnyAsync(l => l.WorkflowTaskId == taskId));
    }

    [Fact]
    public async Task An_active_incentive_suspension_accrues_the_line_as_suspended()
    {
        await using var store = new TestInspectorFeeServiceFactory.Store("flat-incentive");
        await SeedFlatAssignmentAsync(store, amount: 350m, hasCompensation: true);
        store.Fin.IncentiveSuspensions.Add(new IncentiveSuspension
        {
            Id = Guid.NewGuid(),
            UserId = "user-emp-1",
            AssigneeId = "insp-emp-1",
            TransactionKey = "PO-FLAT",
            Reason = "مخالفة انضباط",
            CreatedByUserId = "supervisor-1",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await store.Fin.SaveChangesAsync();
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var task = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FLAT",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed);
        store.App.WorkflowTasks.Add(task);
        await store.App.SaveChangesAsync();

        await store.Fees().EnsureLedgersForTasksAsync([task]);

        var ledger = await store.App.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(350m, ledger.AgreedFeeSar);
        Assert.Equal(InspectorFeeBillingStatus.Suspended, ledger.BillingStatus);
        Assert.Equal(InspectorFeeBillingStatus.Draft, ledger.PreSuspensionStatus);
        Assert.Equal("مخالفة انضباط", ledger.SuspensionReason);
    }

    [Fact]
    public async Task Creating_an_incentive_suspension_suspends_existing_suspendable_lines()
    {
        await using var store = new TestInspectorFeeServiceFactory.Store("flat-incentive");
        await SeedFlatAssignmentAsync(store, amount: 200m, hasCompensation: true);
        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        store.App.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FLAT",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed));
        store.App.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = taskId,
            PoNumber = "PO-FLAT",
            AssigneeId = "insp-emp-1",
            InspectorType = InspectorFeeRules.TypeEmployee,
            AgreedFeeSar = 200m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await store.App.SaveChangesAsync();

        var (row, error) = await store.IncentiveSuspensions().CreateAsync(
            new CreateIncentiveSuspensionRequest
            {
                AssigneeId = "insp-emp-1",
                TransactionKey = "PO-FLAT",
                Reason = "إيقاف على المعاملة",
            },
            "supervisor-1");

        Assert.Null(error);
        Assert.NotNull(row);
        var ledger = await store.App.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(InspectorFeeBillingStatus.Suspended, ledger.BillingStatus);
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, ledger.PreSuspensionStatus);
    }

    [Fact]
    public void ResolveFromDto_reads_flat_amount_for_employees_only()
    {
        var flat = new PartyFeePricingDto
        {
            PricingKind = PartyFeePricingKinds.Flat,
            FlatAmountSar = 275m,
            FieldInspectorIndividualFeeSar = 999m,
        };
        Assert.Equal(
            275m,
            PartyFeePricingService.ResolveFromDto(
                flat,
                WorkflowTaskKind.FieldInspection,
                InspectorFeeRules.TypeEmployee));
        Assert.Null(
            PartyFeePricingService.ResolveFromDto(
                flat,
                WorkflowTaskKind.FieldInspection,
                InspectorFeeRules.TypeCooperatorIndividual));
    }

    [Fact]
    public async Task Party_rates_assignment_does_not_block_employee_when_flat_table_exists()
    {
        await using var store = new TestInspectorFeeServiceFactory.Store("flat-wrong-assign");
        await SeedFlatAssignmentAsync(store, amount: 350m, hasCompensation: true);

 // Accidental cooperator-table assignment (the production symptom for عبدالله).
        var partyRatesId = Guid.NewGuid();
        store.Fin.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = partyRatesId,
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "متعاونين",
            PricingKind = PartyFeePricingKinds.PartyRates,
            ManagedBy = PartyFeePricingManagers.SystemAdmin,
            IsActive = true,
            FieldInspectorIndividualFeeSar = 400m,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        var assign = store.Fin.PartyFeePricingAssignments.Local
            .Single(a => a.AssigneeId == "insp-emp-1");
        assign.TableId = partyRatesId;
        await store.Fin.SaveChangesAsync();

        var taskId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var task = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FLAT",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "insp-emp-1",
            id: taskId,
            status: WorkflowTaskStatus.Completed);
        store.App.WorkflowTasks.Add(task);
        await store.App.SaveChangesAsync();

        await store.Fees().EnsureLedgersForTasksAsync([task]);

        var ledger = await store.App.InspectorFeeLedgers.AsNoTracking()
            .SingleAsync(l => l.WorkflowTaskId == taskId);
        Assert.Equal(350m, ledger.AgreedFeeSar);
    }

    private static async Task SeedFlatAssignmentAsync(
        TestInspectorFeeServiceFactory.Store store,
        decimal amount,
        bool hasCompensation)
    {
        var tableId = Guid.NewGuid();
        store.Fin.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = tableId,
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "حوافز معاين",
            PricingKind = PartyFeePricingKinds.Flat,
            ManagedBy = PartyFeePricingManagers.Supervisor,
            IsActive = false,
            FlatAmountSar = amount,
            UpdatedAtUtc = DateTime.UtcNow,
        });
 // Category default stays party-rates so cooperators keep a fallback.
        store.Fin.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "افتراضي متعاونين",
            PricingKind = PartyFeePricingKinds.PartyRates,
            ManagedBy = PartyFeePricingManagers.SystemAdmin,
            IsActive = true,
            FieldInspectorIndividualFeeSar = 500m,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        store.Fin.PartyFeePricingAssignments.Add(new PartyFeePricingAssignment
        {
            Id = Guid.NewGuid(),
            TableId = tableId,
            Category = PartyFeePricingCategories.FieldInspector,
            AssigneeId = "insp-emp-1",
            UpdatedAtUtc = DateTime.UtcNow,
        });
        store.Identity.Users.Add(new ApplicationUser
        {
            Id = "user-emp-1",
            UserName = "emp1",
            NormalizedUserName = "EMP1",
            Email = "emp1@test.local",
            NormalizedEmail = "EMP1@TEST.LOCAL",
            DisplayName = "معاين",
        });
        store.Identity.UserProfiles.Add(new UserProfile
        {
            UserId = "user-emp-1",
            DistributionAssigneeId = "insp-emp-1",
            RoleId = "field-inspector",
            HasCompensation = hasCompensation,
            ContractType = ContractType.Internal,
        });
        await store.Fin.SaveChangesAsync();
        await store.Identity.SaveChangesAsync();
    }
}
