using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>Sortable columns of the party billing statement list.</summary>
public enum PartyBillingStatementListSortKey
{
    /// <summary>Creation time — the order the endpoint has always returned.</summary>
    Created,
    Issued,
    Closed,
    Reference,
    TotalNet,
}

/// <summary>
/// Pure allow-list, sort map and status parser for <c>GET /api/party-billing-statements</c>.
/// No EF, no I/O — the repository turns the resolved filter into expressions.
/// See docs/architecture/pagination-contract.md §9.1.
/// </summary>
public static class PartyBillingStatementListQueryRules
{
    public const string SortCreated = "created";
    public const string SortIssued = "issued";
    public const string SortClosed = "closed";
    public const string SortReference = "reference";
    public const string SortTotal = "total";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortCreated, SortIssued, SortClosed, SortReference, SortTotal];

    /// <summary>Unknown keys fall back to the default; the endpoint never answers 400 on sort.</summary>
    public static PartyBillingStatementListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortIssued => PartyBillingStatementListSortKey.Issued,
            SortClosed => PartyBillingStatementListSortKey.Closed,
            SortReference => PartyBillingStatementListSortKey.Reference,
            SortTotal => PartyBillingStatementListSortKey.TotalNet,
            _ => PartyBillingStatementListSortKey.Created,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    /// <summary>
    /// CSV of persisted statuses. <c>null</c> means "no status filter" (blank input). Unknown
    /// tokens are dropped; an input made only of unknown tokens yields an <b>empty</b> list, which
    /// the repository treats as "matches no row" — the behaviour the exact-match filter always had
    /// for a typo, kept so a bad value never widens a payee's view.
    /// </summary>
    public static IReadOnlyList<string>? ResolveStatuses(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;

        return status
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => token.ToLowerInvariant())
            .Where(PartyBillingStatementStatus.All.Contains)
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    /// <summary>The persistence filter a request resolves to — every member is already normalised.</summary>
    public static PartyBillingStatementListFilterQuery ToFilter(PartyBillingStatementListQuery query) =>
        new(
            NormalizeExact(query.AssigneeId),
            ResolveStatuses(query.Status),
            query.IssuedOrLaterOnly,
            NormalizeSearch(query.Q));

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
