using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Server-side filtering / sorting / paging for GET /api/workflow-tasks. Party visibility is part
/// of the same query, so an actor's page and TotalCount always agree.
/// See docs/architecture/pagination-contract.md.
/// </summary>
public class WorkflowTaskListQueryTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Plain_list_keeps_the_legacy_order()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var rows = await query.ListAsync(Staff());

        Assert.Equal(
            ["survey-b", "inspection-b", "parent-b", "inspection-a", "parent-a"],
            rows.Select(r => r.Title));
    }

    [Fact]
    public async Task Paged_list_returns_the_requested_window_and_total()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var page = await query.ListPagedAsync(
            new WorkflowTaskListQuery { Page = 2, PageSize = 2 },
            Staff());

        Assert.Equal(5, page.TotalCount);
        Assert.Equal(["parent-b", "inspection-a"], page.Items.Select(r => r.Title));
    }

    [Fact]
    public async Task Kind_filter_accepts_a_comma_separated_list()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var page = await query.ListPagedAsync(
            new WorkflowTaskListQuery
            {
                Page = 1,
                PageSize = 50,
                Kind = "field-inspection,engineering-survey",
            },
            Staff());

        Assert.Equal(3, page.TotalCount);
        Assert.All(page.Items, item => Assert.NotEqual(
            WorkflowTaskKindValues.CaseStudyProperty, item.Kind));
    }

    [Fact]
    public async Task Status_and_phase_filters_narrow_the_queue()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var open = await query.ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 50, Status = "open,blocked" },
            Staff());
        Assert.Equal(4, open.TotalCount);
        Assert.DoesNotContain(open.Items, item => item.Title == "survey-b");

        var bourse = await query.ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 50, Phase = "bourse" },
            Staff());
        Assert.Equal("parent-b", Assert.Single(bourse.Items).Title);
    }

    [Fact]
    public async Task Assignee_and_po_filters_are_exact()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var mine = await query.ListAsync(
            new WorkflowTaskListQuery { AssigneeId = "party-assignee" },
            Staff());
        Assert.Equal(["inspection-b", "inspection-a"], mine.Select(r => r.Title));

        var onePo = await query.ListAsync(
            new WorkflowTaskListQuery { PoNumber = "PO-A" },
            Staff());
        Assert.Equal(2, onePo.Count);
    }

    [Fact]
    public async Task Search_matches_po_title_and_assignee_name()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        Assert.Equal(3, (await query.ListAsync(new WorkflowTaskListQuery { Q = "PO-B" }, Staff())).Count);
        Assert.Single(await query.ListAsync(new WorkflowTaskListQuery { Q = "survey-b" }, Staff()));
        Assert.Equal(
            2,
            (await query.ListAsync(new WorkflowTaskListQuery { Q = "معاين" }, Staff())).Count);
    }

    [Fact]
    public async Task Sort_key_and_direction_come_from_the_allow_list()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var byPo = await query.ListAsync(
            new WorkflowTaskListQuery { Sort = "po", Dir = "asc" },
            Staff());
        Assert.Equal(["PO-A", "PO-A", "PO-B", "PO-B", "PO-B"], byPo.Select(r => r.PoNumber));

        var byUpdated = await query.ListAsync(
            new WorkflowTaskListQuery { Sort = "updated", Dir = "desc" },
            Staff());
        Assert.Equal("parent-a", byUpdated[0].Title);
    }

    /// <summary>The queue's "oldest first" order: the receipt date of the task's work order.</summary>
    [Fact]
    public async Task Po_derived_sorts_order_by_the_work_order()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var oldestFirst = await query.ListAsync(
            new WorkflowTaskListQuery { Sort = "poReceived", Dir = "asc" },
            Staff());

        Assert.Equal("PO-B", oldestFirst[0].PoNumber);
        Assert.Equal("PO-A", oldestFirst[^1].PoNumber);
    }

    [Fact]
    public async Task Unknown_sort_falls_back_instead_of_failing()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var rows = await query.ListAsync(
            new WorkflowTaskListQuery { Sort = "deed", Dir = "elsewhere" },
            Staff());

        Assert.Equal("survey-b", rows[0].Title);
    }

    /// <summary>
    /// Visibility runs inside the query: the party sees only their two rows and the count says two.
    /// </summary>
    [Fact]
    public async Task Party_visibility_is_applied_before_paging()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var page = await query.ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 1 },
            Party());

        Assert.Equal(2, page.TotalCount);
        Assert.Equal("inspection-b", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task Party_filter_and_visibility_compose()
    {
        await using var db = CreateDb();
        Seed(db);
        var query = CreateQuery(db);

        var page = await query.ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 50, Kind = "engineering-survey" },
            Party());

        Assert.Equal(0, page.TotalCount);
        Assert.Empty(page.Items);
    }

    private static PermissionsDto Staff() => new()
    {
        UserId = "staff-1",
        PrototypeRole = "case-specialist",
    };

    private static PermissionsDto Party() => new()
    {
        UserId = "party-user",
        PrototypeRole = "field-inspector",
        DistributionAssigneeId = "party-assignee",
    };

    private static void Seed(CaseStudyDbContext db)
    {
        var parentA = Guid.Parse("aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa");
        var parentB = Guid.Parse("bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb");

        db.WorkOrders.AddRange(
 // PO-A was received later than PO-B, so "oldest first" puts PO-B on top.
            new WorkOrder
            {
                Id = Guid.NewGuid(),
                PoNumber = "PO-A",
                CreatedAtUtc = Now.AddDays(-5),
                ReceivedFromEnfathAt = new DateOnly(2026, 8, 20),
            },
            new WorkOrder
            {
                Id = Guid.NewGuid(),
                PoNumber = "PO-B",
                CreatedAtUtc = Now.AddDays(-1),
                ReceivedFromEnfathAt = new DateOnly(2026, 8, 1),
            });

        var survey = WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-B",
            Now.AddDays(-1),
            title: "survey-b",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب",
            assigneeId: "office-assignee",
            parentTaskId: parentB);
        survey.Complete(Now.AddDays(-1));

        var blocked = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-A",
            Now.AddDays(-5),
            title: "parent-a",
            phase: WorkflowTaskPhase.CaseStudy,
            id: parentA);
        blocked.Block("تعذر", Now);

        db.WorkflowTasks.AddRange(
            blocked,
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-A",
                Now.AddDays(-4),
                title: "inspection-a",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "field-inspector",
                assigneeName: "معاين أ",
                assigneeId: "party-assignee",
                parentTaskId: parentA,
                assignmentType: AssignmentTypeLabels.Execution),
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-B",
                Now.AddDays(-3),
                title: "parent-b",
                phase: WorkflowTaskPhase.Bourse,
                id: parentB),
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-B",
                Now.AddDays(-2),
                title: "inspection-b",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "field-inspector",
                assigneeName: "معاين ب",
                assigneeId: "party-assignee",
                parentTaskId: parentB,
                assignmentType: AssignmentTypeLabels.Estates),
            survey);

        db.SaveChanges();
    }

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"wt-list-query-{Guid.NewGuid():N}")
            .Options);

    private static WorkflowTaskQueryService CreateQuery(CaseStudyDbContext db) =>
        new(db, Options.Create(new DatabaseOptions()));
}
