using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>Sortable columns of the Enfaz ready-PO list.</summary>
public enum EnfazReadyPoListSortKey
{
    /// <summary>
    /// The readiness scan's own order — work orders newest first, as
    /// <c>ICaseStudyLookup.ListWorkOrdersForBillingAsync</c> yields them. The DTO carries no date,
    /// so <c>dir=asc</c> simply reverses the scan.
    /// </summary>
    Created,
    PoNumber,
}

/// <summary>
/// Pure allow-list, sort map and in-memory filter for <c>GET /api/enfaz-billing/ready-pos-summary</c>.
/// The rows are synthesised per work order, so the search and sort run over the materialised
/// list before the page is cut. No I/O. See docs/architecture/pagination-contract.md §10.1.
/// </summary>
public static class EnfazReadyPoListQueryRules
{
    public const string SortCreated = "created";
    public const string SortPo = "po";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } = [SortCreated, SortPo];

    public static EnfazReadyPoListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortPo => EnfazReadyPoListSortKey.PoNumber,
            _ => EnfazReadyPoListSortKey.Created,
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

    public static bool Matches(EnfazReadyPoSummaryDto row, string search) =>
        !string.IsNullOrEmpty(row.PoNumber)
        && row.PoNumber.Contains(search, StringComparison.OrdinalIgnoreCase);

    /// <summary>Search then sort over the scan's output (which is newest work order first).</summary>
    public static List<EnfazReadyPoSummaryDto> Apply(
        IReadOnlyList<EnfazReadyPoSummaryDto> scanned,
        EnfazReadyPoListQuery query)
    {
        var search = NormalizeSearch(query.Q);
        IEnumerable<EnfazReadyPoSummaryDto> rows = search is null
            ? scanned
            : scanned.Where(row => Matches(row, search));

        var descending = ResolveDescending(query.Dir);
        return ResolveSort(query.Sort) switch
        {
            EnfazReadyPoListSortKey.PoNumber => (descending
                    ? rows.OrderByDescending(row => row.PoNumber, StringComparer.Ordinal)
                    : rows.OrderBy(row => row.PoNumber, StringComparer.Ordinal))
                .ToList(),
            _ => descending ? rows.ToList() : rows.Reverse().ToList(),
        };
    }

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
