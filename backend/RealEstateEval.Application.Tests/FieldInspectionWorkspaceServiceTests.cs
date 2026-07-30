using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FieldInspectionWorkspaceServiceTests
{
    private static readonly Guid OwnedTaskId =
        Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid ForeignTaskId =
        Guid.Parse("10000000-0000-0000-0000-000000000002");

    [Fact]
    public async Task List_scopes_party_actor_to_assigned_workspaces()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = new FieldInspectionWorkspaceService(db);

        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "party-user",
            PrototypeRole = "field-inspector",
            DistributionAssigneeId = "assigned-party",
        });

        var row = Assert.Single(rows);
        Assert.Equal(OwnedTaskId.ToString(), row.WorkflowTaskId);
    }

    [Fact]
    public async Task List_allows_case_staff_to_view_all_workspaces()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = new FieldInspectionWorkspaceService(db);

        var rows = await service.ListAsync(new PermissionsDto
        {
            UserId = "case-staff",
            PrototypeRole = "case-specialist",
        });

        Assert.Equal(2, rows.Count);
    }

    [Fact]
    public async Task Summary_preserves_workspace_aggregates()
    {
        await using var db = CreateDb();
        Seed(db);
        var service = new FieldInspectionWorkspaceService(db);

        var summary = await service.GetSummaryAsync();

        Assert.Equal(2, summary.Total);
        Assert.Equal(1, summary.Draft);
        Assert.Equal(1, summary.Submitted);
        Assert.Equal(3, summary.PhotosPendingApproval);
        Assert.Equal(2, summary.IncompleteRequiredPhotos);
    }

    private static void Seed(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.AddRange(
            NewTask(OwnedTaskId, "assigned-party", now),
            NewTask(ForeignTaskId, "other-party", now.AddMinutes(-1)));
        db.FieldInspectionWorkspaces.AddRange(
            NewWorkspace(
                OwnedTaskId,
                PartyTaskSubmissionStatus.Draft,
                required: 4,
                completed: 2,
                pending: 1,
                now),
            NewWorkspace(
                ForeignTaskId,
                PartyTaskSubmissionStatus.Submitted,
                required: 3,
                completed: 3,
                pending: 2,
                now.AddMinutes(-1)));
        db.SaveChanges();
    }

    private static WorkflowTask NewTask(Guid id, string assigneeId, DateTime now) =>
        WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-FIELD",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            id: id,
            assigneeId: assigneeId);

    private static FieldInspectionWorkspace NewWorkspace(
        Guid taskId,
        string status,
        int required,
        int completed,
        int pending,
        DateTime now) =>
        new()
        {
            WorkflowTaskId = taskId,
            PartyTaskSubmissionId = Guid.NewGuid(),
            PoNumber = "PO-FIELD",
            Status = status,
            RequiredPhotoSlots = required,
            CompletedPhotoSlots = completed,
            PendingPhotoApprovals = pending,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

    private static ApplicationDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"field-workspace-query-{Guid.NewGuid():N}")
            .Options);
}
