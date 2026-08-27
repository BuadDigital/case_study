using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public class WorkflowTaskReadAuthorizationTests
{
    [Fact]
    public async Task List_returns_only_tasks_owned_by_external_party()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);

        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "party-user",
            PrototypeRole = "field-inspector",
            DistributionAssigneeId = "party-assignee",
        });

        Assert.Single(rows);
        Assert.Equal("party-assignee", rows[0].AssigneeId);
    }

    [Fact]
    public async Task Paged_list_counts_only_visible_tasks()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);

        var result = await service.ListPagedAsync(
            page: 1,
            pageSize: 25,
            actor: new PermissionsDto
            {
                UserId = "party-user",
                PrototypeRole = "field-inspector",
                DistributionAssigneeId = "party-assignee",
            });

        Assert.Single(result.Items);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task List_returns_no_tasks_when_actor_is_null()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);

        var rows = await service.ListAsync(actor: null);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task List_returns_all_tasks_for_case_staff()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);

        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "staff-user",
            PrototypeRole = "case-specialist",
        });

        Assert.Equal(4, rows.Count);
    }

    private static void Seed(CaseStudyDbContext db)
    {
        var parentId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var propertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var now = DateTime.UtcNow;

        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-parent",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "specialist",
                assigneeId: "specialist-1",
                id: parentId,
                propertyId: propertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-parent",
                now,
                title: "inspection",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "field-inspector",
                assigneeName: "inspector",
                assigneeId: "party-assignee",
                parentTaskId: parentId,
                propertyId: propertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.EngineeringSurvey,
                "PO-parent",
                now,
                title: "survey",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "engineering-office",
                assigneeName: "office",
                assigneeId: "office-assignee",
                parentTaskId: parentId,
                propertyId: propertyId),
            Task("other-assignee", "field-inspector"));
        db.SaveChanges();
    }

    private static WorkflowTask Task(string assigneeId, string role) =>
        WorkflowTask.Create(
            role == "field-inspector"
                ? WorkflowTaskKind.FieldInspection
                : WorkflowTaskKind.EngineeringSurvey,
            $"PO-{assigneeId}",
            DateTime.UtcNow,
            title: assigneeId,
            phase: WorkflowTaskPhase.Done,
            assigneeRole: role,
            assigneeName: assigneeId,
            assigneeId: assigneeId);

    [Fact]
    public async Task List_marks_engineering_survey_when_sibling_inspection_completed()
    {
        await using var db = CreateDb();
        var parentId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var propertyId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var now = DateTime.UtcNow;
        var inspection = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-done",
            now,
            title: "fi",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "fi",
            assigneeId: "fi-1",
            parentTaskId: parentId,
            propertyId: propertyId);
        inspection.Complete(now);
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-done",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "cs",
                assigneeId: "cs-1",
                id: parentId,
                propertyId: propertyId),
            inspection,
            WorkflowTask.Create(
                WorkflowTaskKind.EngineeringSurvey,
                "PO-done",
                now,
                title: "survey",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "engineering-office",
                assigneeName: "office",
                assigneeId: "office-1",
                parentTaskId: parentId,
                propertyId: propertyId));
        await db.SaveChangesAsync();

        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "office-user",
            PrototypeRole = "engineering-office",
            DistributionAssigneeId = "office-1",
        });

        Assert.Single(rows);
        Assert.Equal("engineering-survey", rows[0].Kind);
        Assert.True(rows[0].FieldInspectionCompleted);
        Assert.Equal(inspection.Id.ToString(), rows[0].FieldInspectionTaskId);
    }

    [Fact]
    public async Task List_marks_property_appraisal_when_sibling_inspection_completed()
    {
        await using var db = CreateDb();
        var parentId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        var propertyId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");
        var now = DateTime.UtcNow;
        var inspection = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-appraise",
            now,
            title: "fi",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "fi",
            assigneeId: "fi-1",
            parentTaskId: parentId,
            propertyId: propertyId);
        inspection.Complete(now);
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-appraise",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "cs",
                assigneeId: "cs-1",
                id: parentId,
                propertyId: propertyId),
            inspection,
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-appraise",
                now,
                title: "appraisal",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "real-estate-appraiser",
                assigneeName: "val",
                assigneeId: "val-1",
                parentTaskId: parentId,
                propertyId: propertyId));
        await db.SaveChangesAsync();

        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "val-user",
            PrototypeRole = "real-estate-appraiser",
            DistributionAssigneeId = "val-1",
        });

        Assert.Single(rows);
        Assert.Equal("property-appraisal", rows[0].Kind);
        Assert.True(rows[0].FieldInspectionCompleted);
        Assert.False(rows[0].FieldInspectionAccepted);
        Assert.Equal(inspection.Id.ToString(), rows[0].FieldInspectionTaskId);
    }

    [Fact]
    public async Task List_marks_property_appraisal_accepted_when_sibling_inspection_stamped()
    {
        await using var db = CreateDb();
        var parentId = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var propertyId = Guid.Parse("34343434-3434-3434-3434-343434343434");
        var now = DateTime.UtcNow;
        var inspection = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-accept-fi",
            now,
            title: "fi",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "fi",
            assigneeId: "fi-1",
            parentTaskId: parentId,
            propertyId: propertyId);
        inspection.Complete(now);
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-accept-fi",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "cs",
                assigneeId: "cs-1",
                id: parentId,
                propertyId: propertyId),
            inspection,
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-accept-fi",
                now,
                title: "appraisal",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "real-estate-appraiser",
                assigneeName: "val",
                assigneeId: "val-1",
                parentTaskId: parentId,
                propertyId: propertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = inspection.Id,
            Kind = "field-inspection",
            Status = "submitted",
            PropertyId = propertyId,
            PoNumber = "PO-accept-fi",
            PayloadJson = "{}",
            AcceptedAtUtc = now,
            AcceptedByName = "أخصائي",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync();

        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "val-user",
            PrototypeRole = "real-estate-appraiser",
            DistributionAssigneeId = "val-1",
        });

        Assert.Single(rows);
        Assert.Equal("property-appraisal", rows[0].Kind);
        Assert.True(rows[0].FieldInspectionCompleted);
        Assert.True(rows[0].FieldInspectionAccepted);
        Assert.Equal(inspection.Id.ToString(), rows[0].FieldInspectionTaskId);
    }

    [Fact]
    public async Task List_marks_property_appraisal_false_when_sibling_inspection_open()
    {
        await using var db = CreateDb();
        var parentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var propertyId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var now = DateTime.UtcNow;
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-open-fi",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "cs",
                assigneeId: "cs-1",
                id: parentId,
                propertyId: propertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-open-fi",
                now,
                title: "fi",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "field-inspector",
                assigneeName: "fi",
                assigneeId: "fi-1",
                parentTaskId: parentId,
                propertyId: propertyId),
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-open-fi",
                now,
                title: "appraisal",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "real-estate-appraiser",
                assigneeName: "val",
                assigneeId: "val-1",
                parentTaskId: parentId,
                propertyId: propertyId));
        await db.SaveChangesAsync();

        var service = TestInspectorFeeServiceFactory.CreateWorkflow(db);
        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "val-user",
            PrototypeRole = "real-estate-appraiser",
            DistributionAssigneeId = "val-1",
        });

        Assert.Single(rows);
        Assert.Equal("property-appraisal", rows[0].Kind);
        Assert.False(rows[0].FieldInspectionCompleted);
        Assert.Null(rows[0].FieldInspectionTaskId);
    }

    private static CaseStudyDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"workflow-read-auth-{Guid.NewGuid():N}")
            .Options;
        return new CaseStudyDbContext(options);
    }
}
