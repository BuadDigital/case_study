using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

public class WorkOrderReadAuthorizationTests
{
    [Fact]
    public async Task List_returns_only_pos_with_assigned_tasks_for_party()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = CreateService(db);

        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "party-user",
            PrototypeRole = "field-inspector",
            DistributionAssigneeId = "party-assignee",
            Capabilities = ["submit-party-work"],
        });

        Assert.Single(rows);
        Assert.Equal("PO-OWNED", rows[0].PoNumber);
    }

    [Fact]
    public async Task Get_hides_unassigned_po_from_party()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = CreateService(db);

        var dto = await service.GetByPoNumberAsync(
            "PO-OTHER",
            new PermissionsDto
            {
                UserId = "party-user",
                PrototypeRole = "engineering-office",
                DistributionAssigneeId = "party-assignee",
                Capabilities = ["submit-party-work"],
            });

        Assert.Null(dto);
    }

    [Fact]
    public async Task List_returns_all_for_case_staff()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = CreateService(db);

        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "staff",
            PrototypeRole = "case-specialist",
            Capabilities = ["manage-work-orders"],
        });

        Assert.Equal(2, rows.Count);
    }

    private static void Seed(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkOrders.AddRange(
            new WorkOrder
            {
                Id = Guid.NewGuid(),
                PoNumber = "PO-OWNED",
                CreatedAtUtc = now,
            },
            new WorkOrder
            {
                Id = Guid.NewGuid(),
                PoNumber = "PO-OTHER",
                CreatedAtUtc = now,
            });
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-OWNED",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "party-assignee"));
        db.SaveChanges();
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"wo-read-auth-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static RealEstateEval.Infrastructure.Services.WorkOrderService CreateService(
        ApplicationDbContext db)
    {
        var timeline = new RealEstateEval.Infrastructure.Services.PropertyTimelineService(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        var failures = new RealEstateEval.Infrastructure.Services.FailureService(
            db,
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            timeline,
            notifications,
            recipients);
        return new RealEstateEval.Infrastructure.Services.WorkOrderService(
            db,
            timeline,
            failures,
            notifications,
            recipients);
    }
}
