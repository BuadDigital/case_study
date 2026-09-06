using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>Sortable columns of the ready-lines list.</summary>
public enum PartyBillingReadyLineListSortKey
{
    /// <summary>Last ledger update — the order <c>OrderReadyLines</c> has always produced.</summary>
    Updated,
    /// <summary>Accrual time; <c>asc</c> gives the dues screen its oldest-first order.</summary>
    Accrued,
    NetFee,
    PoNumber,
}

/// <summary>
/// Pure allow-list, sort map and in-memory filter for
/// <c>GET /api/party-billing-statements/ready-lines</c>. The rows are synthesised by the use
/// case, so unlike the EF-backed lists this module also applies the search and the sort — over
/// the full materialised list, before the page is cut. No I/O.
/// See docs/architecture/pagination-contract.md §9.2.
/// </summary>
public static class PartyBillingReadyLineListQueryRules
{
    public const string SortUpdated = "updated";
    public const string SortAccrued = "accrued";
    public const string SortNet = "net";
    public const string SortPo = "po";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortUpdated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortUpdated, SortAccrued, SortNet, SortPo];

    public static PartyBillingReadyLineListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortAccrued => PartyBillingReadyLineListSortKey.Accrued,
            SortNet => PartyBillingReadyLineListSortKey.NetFee,
            SortPo => PartyBillingReadyLineListSortKey.PoNumber,
            _ => PartyBillingReadyLineListSortKey.Updated,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    /// <summary>
    /// The dues screen's haystack: property label, PO number and workflow task id, case-insensitive
    /// substring.
    /// </summary>
    public static bool Matches(PartyBillingReadyLineDto line, string search) =>
        Contains(line.PropertyLabel, search)
        || Contains(line.PoNumber, search)
        || Contains(line.WorkflowTaskId, search);

    /// <summary>Search then sort, with the property label then the task id as tiebreakers.</summary>
    public static List<PartyBillingReadyLineDto> Apply(
        IEnumerable<PartyBillingReadyLineDto> lines,
        PartyBillingReadyLineListQuery query)
    {
        var search = NormalizeSearch(query.Q);
        var filtered = search is null ? lines : lines.Where(line => Matches(line, search));

        var descending = ResolveDescending(query.Dir);
        IOrderedEnumerable<PartyBillingReadyLineDto> ordered = ResolveSort(query.Sort) switch
        {
            PartyBillingReadyLineListSortKey.Accrued => Order(
                filtered, line => line.AccruedAtUtc ?? line.UpdatedAtUtc ?? DateTime.MaxValue, descending),
            PartyBillingReadyLineListSortKey.NetFee => Order(filtered, line => line.NetFeeSar, descending),
            PartyBillingReadyLineListSortKey.PoNumber => Order(
                filtered, line => line.PoNumber ?? "", descending, StringComparer.Ordinal),
            _ => Order(
                filtered, line => line.UpdatedAtUtc ?? line.AccruedAtUtc ?? DateTime.MinValue, descending),
        };

        return ordered
            .ThenBy(line => line.PropertyLabel ?? "", StringComparer.Ordinal)
            .ThenBy(line => line.WorkflowTaskId, StringComparer.Ordinal)
            .ToList();
    }

    private static IOrderedEnumerable<T> Order<T, TKey>(
        IEnumerable<T> rows,
        Func<T, TKey> key,
        bool descending,
        IComparer<TKey>? comparer = null) =>
        descending ? rows.OrderByDescending(key, comparer) : rows.OrderBy(key, comparer);

    private static bool Contains(string? haystack, string needle) =>
        !string.IsNullOrEmpty(haystack)
        && haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
