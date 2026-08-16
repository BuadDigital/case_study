using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// one fee line per (transaction, deed, user). PO-level tasks expand per property.
/// </summary>
public class PerDeedLedgerIndexTests
{
    [Fact]
    public async Task EnsureLedgers_po_level_task_creates_one_row_per_property()
    {
        await using var db = CreateDb();
        var workOrderId = Guid.NewGuid();
        var deed1 = Guid.NewGuid();
        var deed2 = Guid.NewGuid();
        var deed3 = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = "PO-SPLIT",
            CreatedAtUtc = now,
        });
        db.WorkOrderProperties.AddRange(
            new WorkOrderProperty { Id = deed1, WorkOrderId = workOrderId, Area = "100" },
            new WorkOrderProperty { Id = deed2, WorkOrderId = workOrderId, Area = "200" },
            new WorkOrderProperty { Id = deed3, WorkOrderId = workOrderId, Area = "300" });
        db.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "ميداني",
            IsActive = true,
            FieldInspectorIndividualFeeSar = 400m,
            UpdatedAtUtc = now,
        });

        var poLevel = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-SPLIT",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "fi-ahmed",
            propertyId: null,
            id: Guid.NewGuid(),
            status: WorkflowTaskStatus.Completed);
        db.WorkflowTasks.Add(poLevel);
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).EnsureLedgersForTasksAsync([poLevel]);

        var rows = await db.InspectorFeeLedgers.AsNoTracking()
            .OrderBy(r => r.DeedId)
            .ToListAsync();
        Assert.Equal(3, rows.Count);
        Assert.All(rows, r => Assert.Equal(poLevel.Id, r.WorkflowTaskId));
        Assert.Equal(
            new[] { deed1, deed2, deed3 }.OrderBy(x => x).ToArray(),
            rows.Select(r => r.DeedId).OrderBy(x => x).ToArray());
        Assert.DoesNotContain(rows, r => r.DeedId == poLevel.Id);
    }

    [Fact]
    public async Task EnsureLedgers_skips_a_second_task_for_the_same_deed_and_user()
    {
        await using var db = CreateDb();
        var workOrderId = Guid.NewGuid();
        var deedId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = "PO-DEED",
            CreatedAtUtc = now,
        });
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = deedId,
            WorkOrderId = workOrderId,
            Area = "500",
        });
        db.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = PartyFeePricingCategories.FieldInspector,
            Name = "ميداني",
            IsActive = true,
            FieldInspectorIndividualFeeSar = 400m,
            UpdatedAtUtc = now,
        });

 // fi-ahmed is the seeded cooperator individual id used when no profile is present.
        var task1 = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-DEED",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "fi-ahmed",
            propertyId: deedId,
            id: Guid.NewGuid(),
            status: WorkflowTaskStatus.Completed);
        var task2 = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-DEED",
            now,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "fi-ahmed",
            propertyId: deedId,
            id: Guid.NewGuid(),
            status: WorkflowTaskStatus.Completed);
        db.WorkflowTasks.AddRange(task1, task2);
        await db.SaveChangesAsync();

        await TestInspectorFeeServiceFactory.Create(db).EnsureLedgersForTasksAsync([task1, task2]);

        var rows = await db.InspectorFeeLedgers.AsNoTracking().ToListAsync();
        Assert.Single(rows);
        Assert.Equal(workOrderId, rows[0].TransactionId);
        Assert.Equal(deedId, rows[0].DeedId);
        Assert.Equal("fi-ahmed", rows[0].UserId);
        Assert.NotEqual(Guid.Empty, rows[0].Id);
        Assert.Equal(task1.Id, rows[0].WorkflowTaskId);
        Assert.Equal(400m, rows[0].AgreedFeeSar);
    }

    [Fact]
    public async Task Unique_triple_is_modeled_on_the_ledger()
    {
        await using var db = CreateDb();
        var entity = db.Model.FindEntityType(typeof(InspectorFeeLedger));
        Assert.NotNull(entity);
        Assert.Equal(nameof(InspectorFeeLedger.Id), entity!.FindPrimaryKey()?.Properties.Single().Name);

        var unique = entity.GetIndexes().Single(i =>
            i.IsUnique
            && i.Properties.Count == 3
            && i.Properties[0].Name == nameof(InspectorFeeLedger.TransactionId));
        Assert.Equal(
            new[]
            {
                nameof(InspectorFeeLedger.TransactionId),
                nameof(InspectorFeeLedger.DeedId),
                nameof(InspectorFeeLedger.UserId),
            },
            unique.Properties.Select(p => p.Name).ToArray());
    }

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"per-deed-{Guid.NewGuid():N}")
            .Options);
}
