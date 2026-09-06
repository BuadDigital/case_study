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
/// The PO-record columns the workflow-task list now joins from <c>WorkOrderProperties</c>: they are
/// on every row, <c>q</c> searches them, and <c>deed</c> / <c>city</c> sort by them. This is what
/// lets the active transaction queue page — see docs/architecture/pagination-contract.md §2.
/// </summary>
public class WorkflowTaskListPoRecordTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    private static readonly Guid RiyadhProperty = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid JeddahProperty = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public async Task Every_row_carries_the_property_columns()
    {
        await using var db = CreateDb();
        Seed(db);

        var rows = await CreateQuery(db).ListAsync(Staff());
        var riyadh = rows.Single(r => r.Title == "riyadh-task");

        Assert.Equal("410107029844", riyadh.DeedNumber);
        Assert.Equal("الرياض", riyadh.City);
        Assert.Equal("النرجس", riyadh.District);
        Assert.Equal("سكني", riyadh.PropertyType);
        Assert.Equal("فيلا", riyadh.Classification);
    }

    /// <summary>Additive: a task with no property (an unfilled slot) leaves every field null.</summary>
    [Fact]
    public async Task A_task_without_a_property_leaves_the_columns_null()
    {
        await using var db = CreateDb();
        Seed(db);

        var rows = await CreateQuery(db).ListAsync(Staff());
        var slot = rows.Single(r => r.Title == "unlinked-slot");

        Assert.Null(slot.DeedNumber);
        Assert.Null(slot.City);
        Assert.Null(slot.District);
        Assert.Null(slot.PropertyType);
        Assert.Null(slot.Classification);
    }

    [Theory]
    [InlineData("410107", "riyadh-task")]
    [InlineData("الرياض", "riyadh-task")]
    [InlineData("النرجس", "riyadh-task")]
    [InlineData("تجاري", "jeddah-task")]
    [InlineData("معرض", "jeddah-task")]
    public async Task Search_covers_the_po_record_columns(string q, string expected)
    {
        await using var db = CreateDb();
        Seed(db);

        var page = await CreateQuery(db).ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 10, Q = q },
            Staff());

        Assert.Equal(1, page.TotalCount);
        Assert.Equal(expected, page.Items.Single().Title);
    }

    /// <summary>The task's own columns still match — the property join only widens <c>q</c>.</summary>
    [Fact]
    public async Task Search_still_covers_the_tasks_own_columns()
    {
        await using var db = CreateDb();
        Seed(db);

        var page = await CreateQuery(db).ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 10, Q = "unlinked" },
            Staff());

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("unlinked-slot", page.Items.Single().Title);
    }

    [Fact]
    public async Task Deed_sort_orders_by_the_joined_deed_number()
    {
        await using var db = CreateDb();
        Seed(db);

        var ascending = await CreateQuery(db).ListAsync(
            new WorkflowTaskListQuery { Sort = "deed", Dir = "asc" },
            Staff());

        // The unlinked slot has no deed, so it sorts first ascending.
        Assert.Equal(
            ["unlinked-slot", "jeddah-task", "riyadh-task"],
            ascending.Select(r => r.Title));
    }

    [Fact]
    public async Task City_sort_orders_by_the_joined_city()
    {
        await using var db = CreateDb();
        Seed(db);

        var descending = await CreateQuery(db).ListAsync(
            new WorkflowTaskListQuery { Sort = "city", Dir = "desc" },
            Staff());

        Assert.Equal("jeddah-task", descending[0].Title);
        Assert.Equal("unlinked-slot", descending[^1].Title);
    }

    /// <summary>The join happens per page, so a narrow window still gets its columns filled.</summary>
    [Fact]
    public async Task Paging_still_fills_the_columns()
    {
        await using var db = CreateDb();
        Seed(db);

        var page = await CreateQuery(db).ListPagedAsync(
            new WorkflowTaskListQuery { Page = 1, PageSize = 1, Sort = "deed", Dir = "desc" },
            Staff());

        Assert.Equal(3, page.TotalCount);
        Assert.Equal("410107029844", page.Items.Single().DeedNumber);
    }

    private static void Seed(CaseStudyDbContext db)
    {
        var workOrder = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = "PO-1",
            CreatedAtUtc = Now.AddDays(-3),
            ReceivedFromEnfathAt = new DateOnly(2026, 8, 1),
            Properties =
            [
                new WorkOrderProperty
                {
                    Id = RiyadhProperty,
                    DeedNumber = "410107029844",
                    City = "الرياض",
                    District = "النرجس",
                    PropertyType = "سكني",
                    Classification = "فيلا",
                },
                new WorkOrderProperty
                {
                    Id = JeddahProperty,
                    DeedNumber = "310900112233",
                    City = "جدة",
                    District = "الروضة",
                    PropertyType = "تجاري",
                    Classification = "معرض",
                },
            ],
        };

        db.WorkOrders.Add(workOrder);
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-1",
                Now.AddDays(-3),
                title: "riyadh-task",
                propertyId: RiyadhProperty,
                propertyOrdinal: 1),
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-1",
                Now.AddDays(-2),
                title: "jeddah-task",
                propertyId: JeddahProperty,
                propertyOrdinal: 2),
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-1",
                Now.AddDays(-1),
                title: "unlinked-slot",
                propertyOrdinal: 3));

        db.SaveChanges();
    }

    private static PermissionsDto Staff() => new()
    {
        UserId = "staff-1",
        PrototypeRole = "case-specialist",
    };

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"wt-po-record-{Guid.NewGuid():N}")
            .Options);

    private static WorkflowTaskQueryService CreateQuery(CaseStudyDbContext db) =>
        new(db, Options.Create(new DatabaseOptions()));
}
