using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Server-side filtering / sorting / paging for GET /api/work-orders. Everything asserted here is
/// produced by the query itself — no row is dropped after materialisation, so the page contents and
/// TotalCount always agree. See docs/architecture/pagination-contract.md.
/// </summary>
public class WorkOrderListQueryTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Plain_list_keeps_the_legacy_order_and_shape()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var rows = await query.ListAsync(Staff());

        Assert.Equal(["PO-004", "PO-003", "PO-002", "PO-001"], rows.Select(r => r.PoNumber));
    }

    [Fact]
    public async Task Paged_list_returns_the_requested_window_and_total()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var page = await query.ListPagedAsync(
            new WorkOrderListQuery { Page = 2, PageSize = 2 },
            Staff());

        Assert.Equal(4, page.TotalCount);
        Assert.Equal(2, page.Page);
        Assert.Equal(2, page.PageSize);
        Assert.Equal(["PO-002", "PO-001"], page.Items.Select(r => r.PoNumber));
    }

    [Fact]
    public async Task Sort_key_and_direction_come_from_the_allow_list()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var ascending = await query.ListAsync(
            new WorkOrderListQuery { Sort = "po", Dir = "asc" },
            Staff());
        Assert.Equal(["PO-001", "PO-002", "PO-003", "PO-004"], ascending.Select(r => r.PoNumber));

        var byDue = await query.ListAsync(
            new WorkOrderListQuery { Sort = "due", Dir = "asc" },
            Staff());
        Assert.Equal("PO-001", byDue[0].PoNumber);
    }

    [Fact]
    public async Task Unknown_sort_falls_back_instead_of_failing()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var rows = await query.ListAsync(
            new WorkOrderListQuery { Sort = "not-a-column", Dir = "sideways" },
            Staff());

        Assert.Equal(["PO-004", "PO-003", "PO-002", "PO-001"], rows.Select(r => r.PoNumber));
    }

    [Fact]
    public async Task Type_filter_narrows_to_the_assignment_type_label()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var page = await query.ListPagedAsync(
            new WorkOrderListQuery { Page = 1, PageSize = 50, Type = AssignmentTypeLabels.Estates },
            Staff());

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("PO-002", page.Items.Single().PoNumber);
    }

    [Theory]
    [InlineData(WorkOrderListStatus.New, "PO-001")]
    [InlineData(WorkOrderListStatus.Completed, "PO-003")]
    [InlineData(WorkOrderListStatus.Cancelled, "PO-004")]
    public async Task Status_filter_uses_the_same_buckets_the_list_shows(string status, string expected)
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var page = await query.ListPagedAsync(
            new WorkOrderListQuery { Page = 1, PageSize = 50, Status = status },
            Staff());

        Assert.Equal(1, page.TotalCount);
        Assert.Equal(expected, page.Items.Single().PoNumber);
        Assert.Equal(status, page.Items.Single().Status);
    }

    [Fact]
    public async Task Under_study_bucket_holds_the_partly_studied_order()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var page = await query.ListPagedAsync(
            new WorkOrderListQuery { Page = 1, PageSize = 50, Status = WorkOrderListStatus.UnderStudy },
            Staff());

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("PO-002", page.Items.Single().PoNumber);
    }

    [Fact]
    public async Task Search_matches_po_number_deed_number_and_specialist()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var byPo = await query.ListAsync(new WorkOrderListQuery { Q = "PO-003" }, Staff());
        Assert.Equal("PO-003", Assert.Single(byPo).PoNumber);

        var byDeed = await query.ListAsync(new WorkOrderListQuery { Q = "77123" }, Staff());
        Assert.Equal("PO-002", Assert.Single(byDeed).PoNumber);

        var bySpecialist = await query.ListAsync(new WorkOrderListQuery { Q = "سلمى" }, Staff());
        Assert.Equal("PO-003", Assert.Single(bySpecialist).PoNumber);
    }

    [Fact]
    public async Task Search_matches_the_assignment_type_label()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var rows = await query.ListAsync(
            new WorkOrderListQuery { Q = AssignmentTypeLabels.Estates },
            Staff());

        Assert.Equal("PO-002", Assert.Single(rows).PoNumber);
    }

    /// <summary>
    /// Visibility runs inside the query, so a party's TotalCount is their own — not the table's.
    /// </summary>
    [Fact]
    public async Task Party_visibility_is_applied_before_paging()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var page = await query.ListPagedAsync(
            new WorkOrderListQuery { Page = 1, PageSize = 50 },
            Party());

        Assert.Equal(1, page.TotalCount);
        Assert.Equal("PO-002", page.Items.Single().PoNumber);
    }

    [Fact]
    public async Task Party_filter_and_visibility_compose()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var page = await query.ListPagedAsync(
            new WorkOrderListQuery { Page = 1, PageSize = 50, Q = "PO-003" },
            Party());

        Assert.Equal(0, page.TotalCount);
        Assert.Empty(page.Items);
    }

    private static PermissionsDto Staff() => new()
    {
        UserId = "staff-1",
        PrototypeRole = "case-specialist",
        Capabilities = ["manage-work-orders"],
    };

    private static PermissionsDto Party() => new()
    {
        UserId = "party-user",
        PrototypeRole = "field-inspector",
        DistributionAssigneeId = "party-assignee",
        Capabilities = ["submit-party-work"],
    };

 /// <summary>
 /// PO-001 new (no properties), PO-002 partly studied (estates, party assigned), PO-003 fully
 /// studied, PO-004 cancelled.
 /// </summary>
    private static void Seed(CaseStudyDbContext db)
    {
        var studiedProperty = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var openProperty = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var doneProperty = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var cancelledProperty = Guid.Parse("44444444-4444-4444-4444-444444444444");

        db.WorkOrders.AddRange(
            Order("PO-001", Now.AddDays(-4), AssignmentType.Execution, "أحمد", expected: 2),
            Order("PO-002", Now.AddDays(-3), AssignmentType.Estates, "ليلى", expected: 2,
                properties:
                [
                    Property(studiedProperty, "77123"),
                    Property(openProperty, "77124"),
                ]),
            Order("PO-003", Now.AddDays(-2), AssignmentType.PrivateSector, "سلمى", expected: 1,
                properties: [Property(doneProperty, "88001")]),
            Order("PO-004", Now.AddDays(-1), AssignmentType.Execution, "خالد", expected: 1,
                lifecycle: WorkOrderLifecycleStatus.Cancelled,
                properties: [Property(cancelledProperty, "99001")]));

        var studiedTask = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-002",
            Now,
            title: "دراسة",
            phase: WorkflowTaskPhase.CaseStudy,
            propertyId: studiedProperty);
        studiedTask.Complete(Now);

        var doneTask = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-003",
            Now,
            title: "دراسة",
            phase: WorkflowTaskPhase.CaseStudy,
            propertyId: doneProperty);
        doneTask.Complete(Now);

        db.WorkflowTasks.AddRange(
            studiedTask,
            doneTask,
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-002",
                Now,
                title: "دراسة",
                phase: WorkflowTaskPhase.CaseStudy,
                propertyId: openProperty),
 // Party row: the only thing that makes PO-002 visible to the inspector.
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-002",
                Now,
                title: "معاينة",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "field-inspector",
                assigneeName: "معاين",
                assigneeId: "party-assignee",
                propertyId: studiedProperty));

        db.SaveChanges();
    }

    private static WorkOrder Order(
        string poNumber,
        DateTime createdAtUtc,
        AssignmentType type,
        string specialist,
        int expected,
        string? lifecycle = null,
        List<WorkOrderProperty>? properties = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            PoNumber = poNumber,
            AssignmentType = type,
            AssignmentSpecialist = specialist,
            ExpectedPropertyCount = expected,
            LifecycleStatus = lifecycle,
            CreatedAtUtc = createdAtUtc,
            ReceivedFromEnfathAt = DateOnly.FromDateTime(createdAtUtc),
            PromulgationDate = DateOnly.FromDateTime(createdAtUtc),
            DueDateAt = DateOnly.FromDateTime(createdAtUtc.AddDays(10)),
            Properties = properties ?? [],
        };

    private static WorkOrderProperty Property(Guid id, string deedNumber) => new()
    {
        Id = id,
        DeedNumber = deedNumber,
    };

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"wo-list-query-{Guid.NewGuid():N}");

    private static WorkOrderQueryService CreateQuery(TestBoundedContexts.Bundle bundle)
    {
        var caseStudy = bundle.CaseStudy;
        return new WorkOrderQueryService(
            caseStudy,
            new FailureLookup(bundle.Failures),
            new PoEnfazInvoiceLookup(TestInspectorFeeServiceFactory.ShareFinancial(caseStudy)),
            new UserLabelLookup(TestInspectorFeeServiceFactory.ShareIdentity(caseStudy)),
            new WorkOrderLoader(caseStudy),
            new WorkOrderVisibilityFilter(caseStudy),
            Options.Create(new DatabaseOptions()));
    }
}
