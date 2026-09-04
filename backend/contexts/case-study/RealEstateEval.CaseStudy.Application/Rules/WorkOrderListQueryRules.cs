using RealEstateEval.Domain;

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
/// (<c>partially_billed</c> / <c>fully_billed</c>) widen to their study equivalent because the
/// invoice flag lives in the Financial context — see the contract doc.
/// </summary>
public enum WorkOrderListStatusFilter
{
    New,
    UnderStudy,
    Completed,
    Stopped,
    Cancelled,
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

    /// <summary>Newest work order first — the order the endpoint has always returned.</summary>
    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortCreated, SortPo, SortReceived, SortDue];

    public static IReadOnlyList<string> AllowedStatusValues { get; } =
    [
        WorkOrderListStatus.New,
        WorkOrderListStatus.UnderStudy,
        WorkOrderListStatus.Completed,
        WorkOrderListStatus.PartiallyBilled,
        WorkOrderListStatus.FullyBilled,
        WorkOrderListStatus.Stopped,
        WorkOrderListStatus.Cancelled,
    ];

    /// <summary>Unknown keys fall back to the default; the endpoint never answers 400 on sort.</summary>
    public static WorkOrderListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortPo => WorkOrderListSortKey.PoNumber,
            SortReceived => WorkOrderListSortKey.ReceivedFromEnfath,
            SortDue => WorkOrderListSortKey.DueDate,
            _ => WorkOrderListSortKey.Created,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    /// <summary>Null means "no status filter"; an unrecognised value is ignored, not an error.</summary>
    public static WorkOrderListStatusFilter? ResolveStatus(string? status) =>
        Normalize(status) switch
        {
            WorkOrderListStatus.New => WorkOrderListStatusFilter.New,
            WorkOrderListStatus.UnderStudy or WorkOrderListStatus.PartiallyBilled =>
                WorkOrderListStatusFilter.UnderStudy,
            WorkOrderListStatus.Completed or WorkOrderListStatus.FullyBilled =>
                WorkOrderListStatusFilter.Completed,
            WorkOrderListStatus.Stopped => WorkOrderListStatusFilter.Stopped,
            WorkOrderListStatus.Cancelled => WorkOrderListStatusFilter.Cancelled,
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

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
