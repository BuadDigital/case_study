using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class CaseStudyLookupTests
{
    [Fact]
    public async Task Completed_case_study_property_ids_skip_open_and_non_parent_tasks()
    {
        await using var db = CreateDb();
        var completedId = Guid.NewGuid();
        var openId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-1",
            now,
            status: WorkflowTaskStatus.Completed,
            propertyId: completedId));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-1",
            now,
            status: WorkflowTaskStatus.Open,
            propertyId: openId));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-1",
            now,
            status: WorkflowTaskStatus.Completed,
            propertyId: Guid.NewGuid()));
        await db.SaveChangesAsync();

        var ids = await new CaseStudyLookup(db).ListCompletedCaseStudyPropertyIdsAsync();

        Assert.Equal(completedId, Assert.Single(ids));
    }

    [Fact]
    public async Task Property_snapshot_and_work_order_summary_round_trip()
    {
        await using var db = CreateDb();
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-SNAP",
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(DateTime.UtcNow),
            DueDateAt = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            CreatedAtUtc = DateTime.UtcNow,
        };
        var property = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            WorkOrderId = order.Id,
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = "DEED-1",
            RequestNumber = "REQ-1",
            OwnerName = "مالك",
            City = "جدة",
            District = "الشاطئ",
            Court = "محكمة جدة",
            Circuit = "1",
            PropertyType = "فيلا",
            DeedStatus = "فعال",
        };
        db.WorkOrders.Add(order);
        db.WorkOrderProperties.Add(property);
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-SNAP",
            DateTime.UtcNow,
            assigneeId: "specialist-1",
            propertyId: property.Id));
        await db.SaveChangesAsync();

        var lookup = new CaseStudyLookup(db);
        var byId = await lookup.GetPropertyAsync(property.Id);
        var byDeed = await lookup.GetPropertyByPoAndDeedAsync("PO-SNAP", "DEED-1");
        var byRequest = await lookup.ListPropertiesByRequestNumbersAsync(["REQ-1"]);
        var summaries = await lookup.ListWorkOrderSummariesAsync();
        var specialist = await lookup.GetCaseSpecialistAssigneeAsync(property.Id);

        Assert.NotNull(byId);
        Assert.Equal("PO-SNAP", byId!.PoNumber);
        Assert.Equal("DEED-1", byId.DeedNumber);
        Assert.Equal(byId.Id, byDeed?.Id);
        Assert.Equal(property.Id, Assert.Single(byRequest).Id);
        var summary = Assert.Single(summaries);
        Assert.Equal("PO-SNAP", summary.PoNumber);
        Assert.Equal(1, summary.PropertyCount);
        Assert.Equal(order.Id, summary.Id);
        Assert.Equal("specialist-1", specialist);
        Assert.Equal(property.WorkOrderId, byId.WorkOrderId);
        Assert.Null(byId.Area);
    }

    [Fact]
    public async Task Gov_review_key_statuses_keep_legacy_queue_rows_only()
    {
        await using var db = CreateDb();
        var propertyId = Guid.NewGuid();
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-GOV",
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(DateTime.UtcNow),
            DueDateAt = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            CreatedAtUtc = DateTime.UtcNow,
        };
        db.WorkOrders.Add(order);
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = propertyId,
            WorkOrderId = order.Id,
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = "DEED-GOV",
            City = "الرياض",
            PropertyType = "أرض",
        });
        var queued = WorkflowTask.Create(
            WorkflowTaskKind.GovernmentReview,
            "PO-GOV",
            DateTime.UtcNow,
            assigneeName: "مراجع",
            propertyId: propertyId);
        var skipped = WorkflowTask.Create(
            WorkflowTaskKind.GovernmentReview,
            "PO-GOV",
            DateTime.UtcNow,
            propertyId: propertyId);
        db.WorkflowTasks.AddRange(queued, skipped);
        db.PartyTaskSubmissions.AddRange(
            new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = queued.Id,
                Kind = WorkflowTaskKindValues.GovernmentReview,
                PayloadJson = """{"keysStatus":"received"}""",
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            },
            new PartyTaskSubmission
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = skipped.Id,
                Kind = WorkflowTaskKindValues.GovernmentReview,
                PayloadJson = """{"keysStatus":"not-required"}""",
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            });
        await db.SaveChangesAsync();

        var rows = await new CaseStudyLookup(db).ListGovReviewKeyStatusesAsync();

        var row = Assert.Single(rows);
        Assert.Equal(propertyId, row.PropertyId);
        Assert.Equal(PropertyKeysStatuses.Received, row.KeysStatus);
        Assert.Equal("DEED-GOV", row.DeedNumber);
        Assert.Equal("مراجع", row.AssigneeName);
    }

    [Fact]
    public async Task Workflow_task_and_billing_snapshots_round_trip()
    {
        await using var db = CreateDb();
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-BILL",
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(DateTime.UtcNow),
            DueDateAt = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            CreatedAtUtc = DateTime.UtcNow,
        };
        var property = new WorkOrderProperty
        {
            Id = Guid.NewGuid(),
            WorkOrderId = order.Id,
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = "DEED-BILL",
            Area = "120",
            District = "النسيم",
        };
        var task = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-BILL",
            DateTime.UtcNow,
            status: WorkflowTaskStatus.Completed,
            propertyId: property.Id,
            assigneeId: "insp-1");
        db.WorkOrders.Add(order);
        db.WorkOrderProperties.Add(property);
        db.WorkflowTasks.Add(task);
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = task.Id,
            Kind = WorkflowTaskKindValues.FieldInspection,
            Status = PartyTaskSubmissionStatus.Submitted,
            PayloadJson = "{}",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var lookup = new CaseStudyLookup(db);
        var byId = Assert.Single(await lookup.ListWorkflowTasksByIdsAsync([task.Id]));
        Assert.Equal(WorkflowTaskKindValues.FieldInspection, byId.Kind);
        Assert.Equal("insp-1", byId.ToWorkflowTask().AssigneeId);
        Assert.Equal(order.Id, await lookup.GetWorkOrderIdByPoNumberAsync("PO-BILL"));
        var billing = Assert.Single(await lookup.ListWorkOrdersForBillingAsync(10));
        Assert.Equal("120", Assert.Single(billing.Properties).Area);
        Assert.Equal(property.Id, Assert.Single(await lookup.ListPropertiesByIdsAsync([property.Id])).Id);
    }

    private static CaseStudyDbContext CreateDb()
    {
        var name = $"case-study-lookup-{Guid.NewGuid():N}";
        return new CaseStudyDbContext(
            new DbContextOptionsBuilder<CaseStudyDbContext>()
                .UseInMemoryDatabase(name, new InMemoryDatabaseRoot())
                .Options);
    }
}
