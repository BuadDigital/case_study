using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Application.Rules;

/// <summary>Sortable columns of the failures queue, resolved from the wire <c>sort</c> value.</summary>
public enum FailureListSortKey
{
 /// <summary>Last touch — the order the endpoint has always returned.</summary>
    Updated,
    Created,
    PoNumber,
    Deed,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/failures</c>. No EF, no I/O — the repository turns
/// these values into expressions. See docs/architecture/pagination-contract.md §5.
/// </summary>
public static class FailureListQueryRules
{
    public const string SortUpdated = "updated";
    public const string SortCreated = "created";
    public const string SortPo = "po";
    public const string SortDeed = "deed";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortUpdated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortUpdated, SortCreated, SortPo, SortDeed];

 /// <summary>Statuses the queue can filter on — the persisted lifecycle values.</summary>
    public static IReadOnlyList<string> AllowedStatusValues { get; } =
    [
        PropertyFailureStatus.Internal,
        PropertyFailureStatus.Review,
        PropertyFailureStatus.Approved,
        PropertyFailureStatus.Returned,
        PropertyFailureStatus.Suspended,
        PropertyFailureStatus.Resolved,
    ];

    public static FailureListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortCreated => FailureListSortKey.Created,
            SortPo => FailureListSortKey.PoNumber,
            SortDeed => FailureListSortKey.Deed,
            _ => FailureListSortKey.Updated,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

 /// <summary>
 /// CSV of persisted statuses. Unrecognised tokens are dropped; an all-unknown list yields no
 /// filter, so the queue is never narrowed to nothing by a typo.
 /// </summary>
    public static IReadOnlyList<string> ResolveStatuses(string? statuses)
    {
        if (string.IsNullOrWhiteSpace(statuses)) return [];

        var parsed = new List<string>();
        foreach (var token in statuses.Split(
                     ',',
                     StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var match = AllowedStatusValues.FirstOrDefault(
                value => string.Equals(value, token, StringComparison.OrdinalIgnoreCase));
            if (match is not null && !parsed.Contains(match)) parsed.Add(match);
        }

        return parsed;
    }

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
