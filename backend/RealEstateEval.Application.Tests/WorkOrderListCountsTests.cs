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
/// GET /api/work-orders/counts — the KPI band the PO screen used to compute over the whole list.
/// Every number is a SQL COUNT over the same filtered, visibility-narrowed set the list pages.
/// Due dates are relative to the real clock because the query resolves "today" from it.
/// See docs/architecture/pagination-contract.md §1.1.
/// </summary>
public class WorkOrderListCountsTests
{
    private static readonly DateTime Now = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);

    private static readonly Guid StudiedProperty = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OpenProperty = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid DoneProperty = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid CancelledProperty = Guid.Parse("44444444-4444-4444-4444-444444444444");

    [Fact]
    public async Task Unfiltered_counts_match_the_screens_kpi_band()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);

        var counts = await CreateQuery(bundle).CountsAsync(WorkOrderListQuery.Empty, Staff());

        Assert.Equal(5, counts.Total);
        Assert.Equal(5, counts.TotalUnfiltered);
        // new + under_study are the two non-terminal buckets.
        Assert.Equal(2, counts.Active);
        Assert.Equal(1, counts.Overdue);
        Assert.Equal(1, counts.DueSoon);
        // Studied live properties across every matched row, terminal ones included.
        Assert.Equal(2, counts.DoneProperties);
    }

    /// <summary>Terminal rows never count as active, however overdue their due date is.</summary>
    [Fact]
    public async Task Terminal_rows_are_not_overdue_or_due_soon()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);

        var counts = await CreateQuery(bundle).CountsAsync(
            new WorkOrderListQuery { Status = WorkOrderListStatus.Completed },
            Staff());

        Assert.Equal(1, counts.Total);
        Assert.Equal(0, counts.Active);
        Assert.Equal(0, counts.Overdue);
        Assert.Equal(0, counts.DueSoon);
        Assert.Equal(1, counts.DoneProperties);
    }

    [Fact]
    public async Task Filters_narrow_the_counters_but_not_the_unfiltered_total()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);

        var counts = await CreateQuery(bundle).CountsAsync(
            new WorkOrderListQuery { Status = WorkOrderListStatus.UnderStudy },
            Staff());

        Assert.Equal(1, counts.Total);
        Assert.Equal(5, counts.TotalUnfiltered);
        Assert.Equal(1, counts.Active);
        Assert.Equal(0, counts.Overdue);
        Assert.Equal(1, counts.DueSoon);
        Assert.Equal(1, counts.DoneProperties);
    }

    /// <summary>The billing labels widen exactly as they do on the list.</summary>
    [Fact]
    public async Task Billing_buckets_widen_to_their_study_equivalent()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);

        var partially = await query.CountsAsync(
            new WorkOrderListQuery { Status = WorkOrderListStatus.PartiallyBilled },
            Staff());
        var underStudy = await query.CountsAsync(
            new WorkOrderListQuery { Status = WorkOrderListStatus.UnderStudy },
            Staff());

        Assert.Equal(underStudy.Total, partially.Total);
        Assert.Equal(underStudy.Active, partially.Active);
    }

    [Fact]
    public async Task Search_narrows_the_counters()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);

        var counts = await CreateQuery(bundle).CountsAsync(
            new WorkOrderListQuery { Q = "77123" },
            Staff());

        Assert.Equal(1, counts.Total);
        Assert.Equal(1, counts.Active);
        Assert.Equal(5, counts.TotalUnfiltered);
    }

    /// <summary>Visibility is applied first, so the counters are the actor's, not the table's.</summary>
    [Fact]
    public async Task Party_visibility_narrows_every_counter()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);

        var counts = await CreateQuery(bundle).CountsAsync(WorkOrderListQuery.Empty, Party());

        Assert.Equal(1, counts.Total);
        Assert.Equal(1, counts.TotalUnfiltered);
        Assert.Equal(1, counts.Active);
        Assert.Equal(1, counts.DoneProperties);
    }

    [Fact]
    public async Task An_actor_who_sees_nothing_gets_zeroes()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);

        var counts = await CreateQuery(bundle).CountsAsync(WorkOrderListQuery.Empty, Nobody());

        Assert.Equal(0, counts.Total);
        Assert.Equal(0, counts.TotalUnfiltered);
        Assert.Equal(0, counts.Active);
        Assert.Equal(0, counts.Overdue);
        Assert.Equal(0, counts.DueSoon);
        Assert.Equal(0, counts.DoneProperties);
    }

    /// <summary>The counters agree with the list they describe.</summary>
    [Fact]
    public async Task Total_equals_the_paged_lists_total()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var query = CreateQuery(bundle);
        var request = new WorkOrderListQuery { Q = "7712" };

        var page = await query.ListPagedAsync(request with { Page = 1, PageSize = 2 }, Staff());
        var counts = await query.CountsAsync(request, Staff());

        Assert.Equal(page.TotalCount, counts.Total);
    }

    private static void Seed(CaseStudyDbContext db)
    {
        db.WorkOrders.AddRange(
 // new: no live properties yet, and already past its due date.
            Order("PO-NEW", expected: 2, due: Today.AddDays(-3)),
 // under_study: two properties, one studied — due the day after tomorrow.
            Order("PO-STUDY", expected: 2, due: Today.AddDays(2),
                properties: [Property(StudiedProperty, "77123"), Property(OpenProperty, "77124")]),
 // completed: the single expected property is studied. Overdue, but terminal.
            Order("PO-DONE", expected: 1, due: Today.AddDays(-9),
                properties: [Property(DoneProperty, "88001")]),
            Order("PO-CANCELLED", expected: 1, due: Today.AddDays(-1),
                lifecycle: WorkOrderLifecycleStatus.Cancelled,
                properties: [Property(CancelledProperty, "99001")]),
            Order("PO-STOPPED", expected: 1, due: Today.AddDays(1),
                lifecycle: WorkOrderLifecycleStatus.Stopped));

        db.WorkflowTasks.AddRange(
            StudyTask("PO-STUDY", StudiedProperty, completed: true),
            StudyTask("PO-STUDY", OpenProperty, completed: false),
            StudyTask("PO-DONE", DoneProperty, completed: true),
            StudyTask("PO-CANCELLED", CancelledProperty, completed: false),
 // Party row: the only thing that makes PO-STUDY visible to the inspector.
            WorkflowTask.Create(
                WorkflowTaskKind.FieldInspection,
                "PO-STUDY",
                Now,
                title: "معاينة",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "field-inspector",
                assigneeName: "معاين",
                assigneeId: "party-assignee",
                propertyId: StudiedProperty));

        db.SaveChanges();
    }

    private static WorkflowTask StudyTask(string poNumber, Guid propertyId, bool completed)
    {
        var task = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            poNumber,
            Now,
            title: "دراسة",
            phase: WorkflowTaskPhase.CaseStudy,
            propertyId: propertyId);
        if (completed) task.Complete(Now);
        return task;
    }

    private static WorkOrder Order(
        string poNumber,
        int expected,
        DateOnly due,
        string? lifecycle = null,
        List<WorkOrderProperty>? properties = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            PoNumber = poNumber,
            AssignmentType = AssignmentType.Execution,
            AssignmentSpecialist = "أحمد",
            ExpectedPropertyCount = expected,
            LifecycleStatus = lifecycle,
            CreatedAtUtc = Now,
            ReceivedFromEnfathAt = DateOnly.FromDateTime(Now),
            PromulgationDate = DateOnly.FromDateTime(Now),
            DueDateAt = due,
            Properties = properties ?? [],
        };

    private static WorkOrderProperty Property(Guid id, string deedNumber) => new()
    {
        Id = id,
        DeedNumber = deedNumber,
    };

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

    private static PermissionsDto Nobody() => new()
    {
        UserId = "",
        PrototypeRole = "field-inspector",
    };

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"wo-counts-{Guid.NewGuid():N}");

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
