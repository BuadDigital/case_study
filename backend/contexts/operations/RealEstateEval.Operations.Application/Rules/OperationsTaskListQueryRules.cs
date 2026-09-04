using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>Sortable orders of the operations-task queue, resolved from the wire <c>sort</c> value.</summary>
public enum OperationsTaskListSortKey
{
 /// <summary>Screen order: active band, then paused, then terminal — newest first inside a band.</summary>
    Queue,
    Created,
    Due,
    Updated,
    Priority,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/operations-tasks</c>. Mirrors the client-side rules
/// in <c>apps/mfe-case-study/src/views/operations-tasks-view-state.ts</c>. No EF, no I/O.
/// </summary>
public static class OperationsTaskListQueryRules
{
    public const string SortQueue = "queue";
    public const string SortCreated = "created";
    public const string SortDue = "due";
    public const string SortUpdated = "updated";
    public const string SortPriority = "priority";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortQueue;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortQueue, SortCreated, SortDue, SortUpdated, SortPriority];

    public static OperationsTaskListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            SortCreated => OperationsTaskListSortKey.Created,
            SortDue => OperationsTaskListSortKey.Due,
            SortUpdated => OperationsTaskListSortKey.Updated,
            SortPriority => OperationsTaskListSortKey.Priority,
            _ => OperationsTaskListSortKey.Queue,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    /// <summary>
    /// Queue band used by the default sort: active first (0), paused next (1), terminal last (2).
    /// Same ranking as the screen's <c>taskStatusRank</c>.
    /// </summary>
    public static int StatusRank(OperationsTaskStatus status) => status switch
    {
        OperationsTaskStatus.Paused => 1,
        OperationsTaskStatus.Completed or OperationsTaskStatus.Cancelled => 2,
        _ => 0,
    };

    /// <summary>Statuses the screen shows when "show all" is off.</summary>
    public static IReadOnlyList<OperationsTaskStatus> ActiveStatuses { get; } =
        [OperationsTaskStatus.Created, OperationsTaskStatus.InProgress];

    /// <summary>
    /// Null when no scope filter applies; false when the value is unrecognised, in which case the
    /// caller must return nothing rather than silently widening the list.
    /// </summary>
    public static (bool Recognised, OperationsTaskScope? Scope) ResolveScope(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope)) return (true, null);
        return OperationsTaskScopeValues.TryParse(scope, out var parsed)
            ? (true, parsed)
            : (false, null);
    }

    public static (bool Recognised, OperationsTaskType? Type) ResolveType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type)) return (true, null);
        return OperationsTaskTypeValues.TryParse(type, out var parsed)
            ? (true, parsed)
            : (false, null);
    }

    public static (bool Recognised, OperationsTaskStatus? Status) ResolveStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return (true, null);
        return OperationsTaskStatusValues.TryParse(status, out var parsed)
            ? (true, parsed)
            : (false, null);
    }

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
