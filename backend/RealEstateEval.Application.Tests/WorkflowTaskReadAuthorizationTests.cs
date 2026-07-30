using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

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

        Assert.Equal(3, rows.Count);
    }

    private static void Seed(ApplicationDbContext db)
    {
        db.WorkflowTasks.AddRange(
            Task("party-assignee", "field-inspector"),
            Task("other-assignee", "field-inspector"),
            Task("office-assignee", "engineering-office"));
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

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"workflow-read-auth-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
