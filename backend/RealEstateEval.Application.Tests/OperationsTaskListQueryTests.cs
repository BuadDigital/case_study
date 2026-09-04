using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Persistence;
using RealEstateEval.Operations.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Server-side filtering / sorting / paging for GET /api/operations-tasks. The executor-queue
/// narrowing is part of the query, so a non-manager's page and TotalCount are their own.
/// See docs/architecture/pagination-contract.md.
/// </summary>
public class OperationsTaskListQueryTests
{
    private const string Manager = "case-specialist";
    private const string Executor = "field-inspector";
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>Queue order: active band newest first, then paused, then terminal.</summary>
    [Fact]
    public async Task Plain_list_uses_the_queue_order()
    {
        var (query, ops) = Create();
        Seed(ops);

        var rows = await query.ListAsync(
            OperationsTaskListQuery.Empty, "manager-1", null, Manager);

        Assert.Equal(
            ["T-005", "T-002", "T-001", "T-003", "T-004"],
            rows.Select(r => r.DisplayId));
    }

    [Fact]
    public async Task Paged_list_returns_the_requested_window_and_total()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 2, PageSize = 2 },
            "manager-1",
            null,
            Manager);

        Assert.Equal(5, page.TotalCount);
        Assert.Equal(2, page.Page);
        Assert.Equal(["T-001", "T-003"], page.Items.Select(r => r.DisplayId));
    }

    [Fact]
    public async Task Legacy_overload_still_returns_the_plain_array()
    {
        var (query, ops) = Create();
        Seed(ops);

        var rows = await query.ListAsync(
            assigneeId: null,
            createdBy: null,
            status: OperationsTaskStatusValues.Paused,
            actorUserId: "manager-1",
            actorAssigneeId: null,
            actorRole: Manager);

        Assert.Equal("T-003", Assert.Single(rows).DisplayId);
    }

    [Fact]
    public async Task Unrecognised_status_still_matches_nothing()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50, Status = "archived" },
            "manager-1",
            null,
            Manager);

        Assert.Equal(0, page.TotalCount);
        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task Scope_and_type_filters_narrow_the_queue()
    {
        var (query, ops) = Create();
        Seed(ops);

        var byScope = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50, Scope = "work_order" },
            "manager-1",
            null,
            Manager);
        Assert.Equal(1, byScope.TotalCount);
        Assert.Equal("T-002", byScope.Items.Single().DisplayId);

        var byType = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50, Type = "court_visit" },
            "manager-1",
            null,
            Manager);
        Assert.Equal(2, byType.TotalCount);
    }

    /// <summary>The screen's "show all" toggle turned off.</summary>
    [Fact]
    public async Task Active_only_drops_paused_and_terminal_rows()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50, ActiveOnly = true },
            "manager-1",
            null,
            Manager);

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(["T-005", "T-002", "T-001"], page.Items.Select(r => r.DisplayId));
    }

    /// <summary>
    /// The half of the hidden-by-failure rule that lives on the task itself: parked on an active
    /// property failure. The other half (a linked property with an open failure) stays client-side.
    /// </summary>
    [Fact]
    public async Task Exclude_failure_paused_drops_rows_parked_on_a_failure()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50, ExcludeFailurePaused = true },
            "manager-1",
            null,
            Manager);

        Assert.Equal(4, page.TotalCount);
        Assert.DoesNotContain(page.Items, item => item.DisplayId == "T-003");
    }

    [Fact]
    public async Task Search_matches_title_display_id_assignee_and_po()
    {
        var (query, ops) = Create();
        Seed(ops);

        Assert.Equal(
            "T-002",
            Assert.Single(await ListAsync(query, new OperationsTaskListQuery { Q = "PO-77" })).DisplayId);
        Assert.Equal(
            "T-004",
            Assert.Single(await ListAsync(query, new OperationsTaskListQuery { Q = "T-004" })).DisplayId);
        Assert.Equal(
            "T-005",
            Assert.Single(await ListAsync(query, new OperationsTaskListQuery { Q = "تصوير" })).DisplayId);
        Assert.Equal(
            2,
            (await ListAsync(query, new OperationsTaskListQuery { Q = "منفّذ ب" })).Count);
    }

    [Fact]
    public async Task Sort_key_and_direction_come_from_the_allow_list()
    {
        var (query, ops) = Create();
        Seed(ops);

        var oldestFirst = await ListAsync(
            query, new OperationsTaskListQuery { Sort = "created", Dir = "asc" });
        Assert.Equal(["T-001", "T-002", "T-003", "T-004", "T-005"],
            oldestFirst.Select(r => r.DisplayId));

        var byDue = await ListAsync(
            query, new OperationsTaskListQuery { Sort = "due", Dir = "asc" });
        Assert.Equal("T-005", byDue[0].DisplayId);

        var byPriority = await ListAsync(
            query, new OperationsTaskListQuery { Sort = "priority", Dir = "asc" });
        Assert.Equal(OperationsTaskPriorityValues.High, byPriority[0].Priority);
    }

    [Fact]
    public async Task Unknown_sort_falls_back_instead_of_failing()
    {
        var (query, ops) = Create();
        Seed(ops);

        var rows = await ListAsync(
            query, new OperationsTaskListQuery { Sort = "assignee", Dir = "elsewhere" });

        Assert.Equal("T-005", rows[0].DisplayId);
    }

    /// <summary>The executor queue is independent: only their own rows, and the count says so.</summary>
    [Fact]
    public async Task Executor_narrowing_is_applied_before_paging()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50 },
            "executor-user",
            "assignee-b",
            Executor);

        Assert.Equal(2, page.TotalCount);
        Assert.Equal(["T-002", "T-004"], page.Items.Select(r => r.DisplayId));
    }

    [Fact]
    public async Task Executor_narrowing_and_filters_compose()
    {
        var (query, ops) = Create();
        Seed(ops);

        var page = await query.ListPagedAsync(
            new OperationsTaskListQuery { Page = 1, PageSize = 50, ActiveOnly = true },
            "executor-user",
            "assignee-b",
            Executor);

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("T-002", page.Items.Single().DisplayId);
    }

    private static Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        OperationsTaskQueryService query,
        OperationsTaskListQuery listQuery) =>
        query.ListAsync(listQuery, "manager-1", null, Manager);

 /// <summary>
 /// T-001 in progress, T-002 created (work-order scope, PO-77, executor b), T-003 paused on a
 /// property failure, T-004 completed (executor b), T-005 created (reshoot, high priority).
 /// </summary>
    private static void Seed(OperationsDbContext ops)
    {
        var inProgress = Task("T-001", OperationsTaskType.CourtVisit, "زيارة دائرة",
            OperationsTaskScope.General, "assignee-a", "منفّذ أ", Now.AddHours(-5),
            OperationsTaskPriority.Medium);
        inProgress.TransitionTo(OperationsTaskStatus.InProgress, Now.AddHours(-4));

        var created = Task("T-002", OperationsTaskType.CourtVisit, "استلام ظرف",
            OperationsTaskScope.WorkOrder, "assignee-b", "منفّذ ب", Now.AddHours(-4),
            OperationsTaskPriority.Low, poNumber: "PO-77");

        var failurePaused = Task("T-003", OperationsTaskType.General, "متوقفة",
            OperationsTaskScope.General, "assignee-a", "منفّذ أ", Now.AddHours(-3),
            OperationsTaskPriority.Medium);
        failurePaused.TransitionTo(
            OperationsTaskStatus.Paused,
            Now.AddHours(-2),
            pauseReason: OperationsTaskLifecycleRules.FailurePauseReasonPrefix
                + " — بانتظار حل الأخصائي/المشرف");

        var completed = Task("T-004", OperationsTaskType.FieldVisit, "زيارة ميدانية",
            OperationsTaskScope.General, "assignee-b", "منفّذ ب", Now.AddHours(-2),
            OperationsTaskPriority.Medium);
        completed.TransitionTo(OperationsTaskStatus.InProgress, Now.AddHours(-1));
        completed.TransitionTo(OperationsTaskStatus.Completed, Now);

        var reshoot = Task("T-005", OperationsTaskType.Reshoot, "إعادة تصوير",
            OperationsTaskScope.General, "assignee-a", "منفّذ أ", Now.AddHours(-1),
            OperationsTaskPriority.High, dueOffsetHours: 1);

        ops.OperationsTasks.AddRange(inProgress, created, failurePaused, completed, reshoot);
        ops.SaveChanges();
    }

    private static OperationsTask Task(
        string displayId,
        OperationsTaskType type,
        string title,
        OperationsTaskScope scope,
        string assigneeId,
        string assigneeName,
        DateTime createdAtUtc,
        OperationsTaskPriority priority,
        string? poNumber = null,
        int dueOffsetHours = 24) =>
        OperationsTask.Create(
            Guid.NewGuid(),
            displayId,
            type,
            title,
            scope,
            assigneeId,
            "creator-1",
            priority,
            createdAtUtc.AddHours(dueOffsetHours),
            createdAtUtc,
            poNumber: poNumber,
            assigneeName: assigneeName,
            createdByName: "منشئ");

    private static (OperationsTaskQueryService Query, OperationsDbContext Ops) Create()
    {
        var name = $"ops-list-query-{Guid.NewGuid():N}";
        var root = new Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot();
        var ops = new OperationsDbContext(new DbContextOptionsBuilder<OperationsDbContext>()
            .UseInMemoryDatabase(name, root)
            .Options);
        var fin = new RealEstateEval.Financial.Infrastructure.Data.Contexts.FinancialDbContext(
            new DbContextOptionsBuilder<
                RealEstateEval.Financial.Infrastructure.Data.Contexts.FinancialDbContext>()
                .UseInMemoryDatabase(name, root)
                .Options);
        var identity = new RealEstateEval.Identity.Infrastructure.Data.Contexts.IdentityDbContext(
            new DbContextOptionsBuilder<
                RealEstateEval.Identity.Infrastructure.Data.Contexts.IdentityDbContext>()
                .UseInMemoryDatabase(name, root)
                .Options);

        var query = new OperationsTaskQueryService(
            ops,
            new CourtVisitFeeChargeService(fin),
            new UserLabelLookup(identity),
            Options.Create(new DatabaseOptions()));
        return (query, ops);
    }
}
