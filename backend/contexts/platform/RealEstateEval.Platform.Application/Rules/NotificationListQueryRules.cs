namespace RealEstateEval.Platform.Application.Rules;

/// <summary>Sortable columns of the notification feed, resolved from the wire <c>sort</c> value.</summary>
public enum NotificationListSortKey
{
 /// <summary>Creation time — the order the bell feed has always returned.</summary>
    Created,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/notifications</c>. The feed has exactly one
/// meaningful order, so the allow-list is a single key; <c>dir</c> still flips it. No EF, no I/O.
/// See docs/architecture/pagination-contract.md §6.
/// </summary>
public static class NotificationListQueryRules
{
    public const string SortCreated = "created";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } = [SortCreated];

    public static NotificationListSortKey ResolveSort(string? sort) => NotificationListSortKey.Created;

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

 /// <summary>
 /// <c>unread=true</c> keeps only notifications the user has not opened; <c>false</c> only the
 /// read ones; omitted means no filter.
 /// </summary>
    public static bool? ResolveUnread(bool? unread) => unread;

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
