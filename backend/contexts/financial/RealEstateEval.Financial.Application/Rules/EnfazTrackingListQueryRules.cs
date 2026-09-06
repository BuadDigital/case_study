using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>Sortable columns of the Enfaz tracking list.</summary>
public enum EnfazTrackingListSortKey
{
    /// <summary>
    /// The scan's own order — work orders newest first, properties in request/deed order inside
    /// each. <c>dir=asc</c> reverses the scan. The row carries no creation date of its own.
    /// </summary>
    Created,
    PoNumber,
    Completed,
    InvoiceIssued,
}

/// <summary>
/// Pure allow-list, sort map and in-memory filter for <c>GET /api/enfaz-billing/tracking</c>.
/// Rows are synthesised per property from cross-context reads, so the search and sort run over
/// the materialised list before the page is cut. No I/O.
/// See docs/architecture/pagination-contract.md §10.2.
/// </summary>
public static class EnfazTrackingListQueryRules
{
    public const string SortCreated = "created";
    public const string SortPo = "po";
    public const string SortCompleted = "completed";
    public const string SortInvoiceIssued = "invoiceIssued";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortCreated, SortPo, SortCompleted, SortInvoiceIssued];

    public static EnfazTrackingListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortPo => EnfazTrackingListSortKey.PoNumber,
            SortCompleted => EnfazTrackingListSortKey.Completed,
            "invoiceissued" => EnfazTrackingListSortKey.InvoiceIssued,
            _ => EnfazTrackingListSortKey.Created,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    /// <summary>The revenue screen's haystack: PO, deed, property label, city and invoice number.</summary>
    public static bool Matches(EnfazTrackingRowDto row, string search) =>
        Contains(row.PoNumber, search)
        || Contains(row.DeedNumber, search)
        || Contains(row.PropertyLabel, search)
        || Contains(row.City, search)
        || Contains(row.InvoiceNumber, search);

    /// <summary>
    /// Search then sort. Every explicit sort ends with PO number then property id as tiebreakers,
    /// so consecutive pages never overlap.
    /// </summary>
    public static List<EnfazTrackingRowDto> Apply(
        IReadOnlyList<EnfazTrackingRowDto> scanned,
        EnfazTrackingListQuery query)
    {
        var search = NormalizeSearch(query.Q);
        IEnumerable<EnfazTrackingRowDto> rows = search is null
            ? scanned
            : scanned.Where(row => Matches(row, search));

        var descending = ResolveDescending(query.Dir);
        var ordered = ResolveSort(query.Sort) switch
        {
            EnfazTrackingListSortKey.PoNumber => Order(rows, row => row.PoNumber ?? "", descending, StringComparer.Ordinal),
            EnfazTrackingListSortKey.Completed => Order(
                rows, row => row.CompletedAtUtc ?? DateTime.MinValue, descending),
            EnfazTrackingListSortKey.InvoiceIssued => Order(
                rows, row => row.InvoiceIssuedAtUtc ?? DateTime.MinValue, descending),
            _ => null,
        };

        if (ordered is null)
            return descending ? rows.ToList() : rows.Reverse().ToList();

        return ordered
            .ThenBy(row => row.PoNumber ?? "", StringComparer.Ordinal)
            .ThenBy(row => row.PropertyId ?? "", StringComparer.Ordinal)
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
