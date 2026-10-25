using RealEstateEval.Domain;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>Sortable columns of the work-order list, resolved from the wire <c>sort</c> value.</summary>
public enum WorkOrderListSortKey
{
    Created,
    PoNumber,
    ReceivedFromEnfath,
    DueDate,
}

/// <summary>
/// Status buckets the PO list can filter on using Case Study data alone. The two billing labels
/// widen to their study equivalent because the invoice flag lives in the Financial context —
/// <c>fully_billed</c> to <c>Completed</c>, <c>partially_billed</c> to <c>Active</c> (an invoiced
/// order can still be under study or ready for the handover). See the contract doc.
/// </summary>
public enum WorkOrderListStatusFilter
{
    New,
    UnderStudy,
    ReadyForEnfaz,
    Completed,
    Stopped,
    Cancelled,
    /// <summary>Every non-terminal bucket: new, under_study, ready_for_enfaz.</summary>
    Active,
    /// <summary>Every terminal bucket: completed, stopped, cancelled.</summary>
    Closed,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/work-orders</c>. Mirrors the client-side rules in
/// <c>apps/mfe-case-study/src/views/po-list-view-state.ts</c> so the screen can move its filtering
/// and sorting to the server. No EF, no I/O — the Persistence query service turns these values into
/// expressions.
/// </summary>
public static class WorkOrderListQueryRules
{
    public const string SortCreated = "created";
    public const string SortPo = "po";
    public const string SortReceived = "received";
    public const string SortDue = "due";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    /// <summary>Filter-only buckets — never a row status.</summary>
    public const string BucketActive = "active";
    public const string BucketClosed = "closed";

    /// <summary>Newest work order first — the order the endpoint has always returned.</summary>
    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortCreated, SortPo, SortReceived, SortDue];

    public static IReadOnlyList<string> AllowedStatusValues { get; } =
    [
        WorkOrderListStatus.New,
        WorkOrderListStatus.UnderStudy,
        WorkOrderListStatus.ReadyForEnfaz,
        WorkOrderListStatus.Completed,
        WorkOrderListStatus.PartiallyBilled,
        WorkOrderListStatus.FullyBilled,
        WorkOrderListStatus.Stopped,
        WorkOrderListStatus.Cancelled,
        BucketActive,
        BucketClosed,
    ];

    /// <summary>Unknown keys fall back to the default; the endpoint never answers 400 on sort.</summary>
    public static WorkOrderListSortKey ResolveSort(string? sort) =>
        ListQueryText.Normalize(sort) switch
        {
            SortPo => WorkOrderListSortKey.PoNumber,
            SortReceived => WorkOrderListSortKey.ReceivedFromEnfath,
            SortDue => WorkOrderListSortKey.DueDate,
            _ => WorkOrderListSortKey.Created,
        };

    public static bool ResolveDescending(string? dir) =>
        ListQueryText.ResolveDescending(dir, DefaultDescending);

    /// <summary>Null means "no status filter"; an unrecognised value is ignored, not an error.</summary>
    public static WorkOrderListStatusFilter? ResolveStatus(string? status) =>
        ListQueryText.Normalize(status) switch
        {
            WorkOrderListStatus.New => WorkOrderListStatusFilter.New,
            WorkOrderListStatus.UnderStudy => WorkOrderListStatusFilter.UnderStudy,
            WorkOrderListStatus.ReadyForEnfaz => WorkOrderListStatusFilter.ReadyForEnfaz,
            WorkOrderListStatus.Completed or WorkOrderListStatus.FullyBilled =>
                WorkOrderListStatusFilter.Completed,
            WorkOrderListStatus.Stopped => WorkOrderListStatusFilter.Stopped,
            WorkOrderListStatus.Cancelled => WorkOrderListStatusFilter.Cancelled,
            BucketActive or WorkOrderListStatus.PartiallyBilled => WorkOrderListStatusFilter.Active,
            BucketClosed => WorkOrderListStatusFilter.Closed,
            _ => null,
        };

    /// <summary>Assignment-type filter: the Arabic label the list shows, else no filter.</summary>
    public static AssignmentType? ResolveAssignmentType(string? type)
    {
        var value = type?.Trim();
        if (string.IsNullOrEmpty(value)) return null;
        return AssignmentTypeLabels.TryParseLabel(value, out var parsed) ? parsed : null;
    }

    /// <summary>
    /// Assignment types whose Arabic label contains the search text — the server-side half of the
    /// screen's `row.type.includes(q)` check.
    /// </summary>
    public static IReadOnlyList<AssignmentType> AssignmentTypesMatching(string? search)
    {
        var q = search?.Trim();
        if (string.IsNullOrEmpty(q)) return [];

        return Enum.GetValues<AssignmentType>()
            .Where(type => AssignmentTypeLabels.ToLabel(type)
                .Contains(q, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    /// <summary>
    /// «تستحق خلال 48 ساعة» window, in whole days after today. The screen compares a due date
    /// parsed at UTC midnight against <c>now</c> and <c>now + 48h</c>, which at date granularity is
    /// always exactly tomorrow and the day after — never today, never day + 3.
    /// </summary>
    public const int DueSoonWindowDays = 2;

    /// <summary>Inclusive upper bound of the due-soon window; the lower bound is <c>today</c> exclusive.</summary>
    public static DateOnly DueSoonUpperBound(DateOnly today) => today.AddDays(DueSoonWindowDays);

    public static string? NormalizeSearch(string? q) =>
        ListQueryText.NormalizeSearch(q);
}
