using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// 2026-11-19: the whole-list reads (`details`, `property-rows`) stopped at 500 work orders and said
/// nothing of the rest — past 500 the oldest dropped off the lists and the map. Paged, every work
/// order comes back, and the total says how many there are.
/// </summary>
public class WorkOrderListPagingTests
{
    private static readonly DateTime Start = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Details_pages_bring_back_every_work_order_past_the_old_500_cap()
    {
        var query = QueryOver(501, out _);

        var first = await query.ListDetailsPagedAsync(1, 500, Staff());
        var second = await query.ListDetailsPagedAsync(2, 500, Staff());

        Assert.Equal(501, first.TotalCount);
        Assert.Equal(2, first.TotalPages);
        Assert.Equal(500, first.Items.Count);
        Assert.Single(second.Items);
        var all = first.Items.Concat(second.Items).Select(w => w.PoNumber).ToList();
        Assert.Equal(501, all.Distinct().Count());
        // Newest first: the oldest order is the one left for the second page.
        Assert.Equal("PO-0000", second.Items.Single().PoNumber);
    }

    [Fact]
    public async Task The_unpaged_details_list_still_stops_at_500()
    {
        var query = QueryOver(501, out _);

        var list = await query.ListDetailsAsync(Staff());

        Assert.Equal(500, list.Count);
    }

    [Fact]
    public async Task Pages_neither_repeat_nor_skip_orders_received_at_the_same_moment()
    {
        // Every order shares one creation time: the PO number decides the order between them.
        var query = QueryOver(7, out _, sameMoment: true);

        var pages = new List<string>();
        for (var page = 1; page <= 3; page++)
            pages.AddRange((await query.ListDetailsPagedAsync(page, 3, Staff())).Items.Select(w => w.PoNumber));

        Assert.Equal(7, pages.Count);
        Assert.Equal(7, pages.Distinct().Count());
    }

    [Fact]
    public async Task Property_rows_page_by_work_order_and_bring_back_every_deed()
    {
        var query = QueryOver(5, out _, deedsPerOrder: 2);

        var first = await query.ListPropertyListItemsPagedAsync(1, 3, Staff());
        var second = await query.ListPropertyListItemsPagedAsync(2, 3, Staff());

        // Totals count work orders; each order gives one row per deed.
        Assert.Equal(5, first.TotalCount);
        Assert.Equal(2, first.TotalPages);
        Assert.Equal(6, first.Items.Count);
        Assert.Equal(4, second.Items.Count);
        Assert.Equal(10, first.Items.Concat(second.Items).Select(r => r.PropertyId).Distinct().Count());
    }

    private static WorkOrderQueryService QueryOver(
        int orders,
        out TestBoundedContexts.Bundle bundle,
        bool sameMoment = false,
        int deedsPerOrder = 0)
    {
        bundle = TestBoundedContexts.Create($"wo-paging-{Guid.NewGuid():N}");
        var caseStudy = bundle.CaseStudy;
        for (var i = 0; i < orders; i++)
        {
            var created = sameMoment ? Start : Start.AddMinutes(i);
            caseStudy.WorkOrders.Add(Order($"PO-{i:D4}", created, deedsPerOrder));
        }
        caseStudy.SaveChanges();

        return new WorkOrderQueryService(
            caseStudy,
            new FailureLookup(bundle.Failures),
            new PoEnfazInvoiceLookup(TestInspectorFeeServiceFactory.ShareFinancial(caseStudy)),
            new UserLabelLookup(TestInspectorFeeServiceFactory.ShareIdentity(caseStudy)),
            new WorkOrderLoader(caseStudy),
            new WorkOrderVisibilityFilter(caseStudy),
            Options.Create(new DatabaseOptions()));
    }

    private static WorkOrder Order(string poNumber, DateTime createdAtUtc, int deeds)
    {
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = poNumber,
            AssignmentType = AssignmentType.Execution,
            AssignmentSpecialist = "أحمد",
            ExpectedPropertyCount = Math.Max(1, deeds),
            CreatedAtUtc = createdAtUtc,
            ReceivedFromEnfathAt = DateOnly.FromDateTime(createdAtUtc),
            PromulgationDate = DateOnly.FromDateTime(createdAtUtc),
            DueDateAt = DateOnly.FromDateTime(createdAtUtc).AddDays(10),
            Properties = [],
        };
        for (var d = 0; d < deeds; d++)
        {
            order.Properties.Add(new WorkOrderProperty
            {
                Id = Guid.NewGuid(),
                WorkOrderId = order.Id,
                DeedNumber = $"{poNumber}-{d}",
                OwnerName = "مالك",
            });
        }
        return order;
    }

    private static PermissionsDto Staff() => new()
    {
        UserId = "staff-1",
        PrototypeRole = "case-specialist", SubRoles = CaseSpecialistSubRoles.All,
        Capabilities = ["manage-work-orders"],
    };
}
