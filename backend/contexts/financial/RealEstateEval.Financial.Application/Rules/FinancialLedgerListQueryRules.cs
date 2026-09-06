namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Sortable columns shared by the two financial ledger lists (incentive suspensions and discount
/// flags). Both rows are append-mostly, so creation time is the meaningful order.
/// </summary>
public enum FinancialLedgerListSortKey
{
 /// <summary>Creation time — the order both endpoints have always returned.</summary>
    Created,
 /// <summary>Transaction key, for grouping a PO's entries together.</summary>
    TransactionKey,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/financial/incentive-suspensions</c> and
/// <c>GET /api/financial/discount-flags</c>. No EF, no I/O.
/// See docs/architecture/pagination-contract.md §7.
/// </summary>
public static class FinancialLedgerListQueryRules
{
    public const string SortCreated = "created";
    public const string SortTransaction = "transaction";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } = [SortCreated, SortTransaction];

    public static FinancialLedgerListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortTransaction => FinancialLedgerListSortKey.TransactionKey,
            _ => FinancialLedgerListSortKey.Created,
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

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
