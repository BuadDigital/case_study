using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;

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
        ListQueryText.Normalize(sort) switch
        {
            SortPo => EnfazTrackingListSortKey.PoNumber,
            SortCompleted => EnfazTrackingListSortKey.Completed,
            "invoiceissued" => EnfazTrackingListSortKey.InvoiceIssued,
            _ => EnfazTrackingListSortKey.Created,
        };

    public static bool ResolveDescending(string? dir) =>
        ListQueryText.ResolveDescending(dir, DefaultDescending);

    public static string? NormalizeSearch(string? q) =>
        ListQueryText.NormalizeSearch(q);

    /// <summary>The revenue screen's haystack: PO, deed, property label, city and invoice number.</summary>
    public static bool Matches(EnfazTrackingRowDto row, string search) =>
        ListQueryText.Contains(row.PoNumber, search)
        || ListQueryText.Contains(row.DeedNumber, search)
        || ListQueryText.Contains(row.PropertyLabel, search)
        || ListQueryText.Contains(row.City, search)
        || ListQueryText.Contains(row.InvoiceNumber, search);

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
            EnfazTrackingListSortKey.PoNumber => ListQueryText.Order(rows, row => row.PoNumber ?? "", descending, StringComparer.Ordinal),
            EnfazTrackingListSortKey.Completed => ListQueryText.Order(
                rows, row => row.CompletedAtUtc ?? DateTime.MinValue, descending),
            EnfazTrackingListSortKey.InvoiceIssued => ListQueryText.Order(
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
}
