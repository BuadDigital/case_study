using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public class WorkOrderReadAuthorizationTests
{
    [Fact]
    public async Task List_returns_only_pos_with_assigned_tasks_for_party()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        Seed(db);
        var service = CreateService(bundle);

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
        var bundle = CreateDb();
        var db = bundle.App;
        Seed(db);
        var service = CreateService(bundle);

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
        var bundle = CreateDb();
        var db = bundle.App;
        Seed(db);
        var service = CreateService(bundle);

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

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"wo-read-auth-{Guid.NewGuid():N}");

    private static RealEstateEval.Infrastructure.Services.WorkOrderService CreateService(
        TestBoundedContexts.Bundle bundle)
    {
        var db = bundle.App;
        var timeline = new RealEstateEval.Infrastructure.Services.PropertyTimelineService(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        var failures = TestBoundedContexts.CreateFailureService(
            bundle,
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            timeline,
            notifications,
            recipients);
        return TestWorkOrderServiceFactory.Create(bundle, notifications, recipients, timeline, failures);
    }
}
