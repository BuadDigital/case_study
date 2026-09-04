using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>Sortable columns of the workflow-task queue, resolved from the wire <c>sort</c> value.</summary>
public enum WorkflowTaskListSortKey
{
 /// <summary>Task creation time — the order the endpoint has always returned.</summary>
    Created,
 /// <summary>Last touch (distribution confirmed, reassignment…) — the queue's own default order.</summary>
    Updated,
    PoNumber,
 /// <summary>Receipt date of the task's work order (queue "oldest first").</summary>
    PoReceived,
 /// <summary>Creation date of the task's work order (queue "newest first").</summary>
    PoCreated,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/workflow-tasks</c>. Mirrors the client-side rules in
/// <c>apps/mfe-case-study/src/views/active-transaction-queue-state.ts</c> and
/// <c>lib/app-data/active-queue-list-filters.ts</c>. No EF, no I/O.
/// </summary>
public static class WorkflowTaskListQueryRules
{
    public const string SortCreated = "created";
    public const string SortUpdated = "updated";
    public const string SortPo = "po";
    public const string SortPoReceived = "poReceived";
    public const string SortPoCreated = "poCreated";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortCreated;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortCreated, SortUpdated, SortPo, SortPoReceived, SortPoCreated];

    public static WorkflowTaskListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            "updated" => WorkflowTaskListSortKey.Updated,
            "po" => WorkflowTaskListSortKey.PoNumber,
            "poreceived" => WorkflowTaskListSortKey.PoReceived,
            "pocreated" => WorkflowTaskListSortKey.PoCreated,
            _ => WorkflowTaskListSortKey.Created,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    /// <summary>Recognised kinds only; an all-unknown list yields an empty filter (no narrowing).</summary>
    public static IReadOnlyList<WorkflowTaskKind> ResolveKinds(string? kinds) =>
        ResolveList<WorkflowTaskKind>(kinds, WorkflowTaskKindValues.TryParse);

    public static IReadOnlyList<WorkflowTaskStatus> ResolveStatuses(string? statuses) =>
        ResolveList<WorkflowTaskStatus>(statuses, WorkflowTaskStatusValues.TryParse);

    public static IReadOnlyList<WorkflowTaskPhase> ResolvePhases(string? phases) =>
        ResolveList<WorkflowTaskPhase>(phases, WorkflowTaskPhaseValues.TryParse);

    /// <summary>Statuses the queue lists by default — <c>isListedQueueTask</c> without the toggle.</summary>
    public static IReadOnlyList<WorkflowTaskStatus> ListedStatuses { get; } =
        [WorkflowTaskStatus.Open, WorkflowTaskStatus.Blocked];

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    private delegate bool TryParse<T>(string? value, out T parsed);

    private static IReadOnlyList<T> ResolveList<T>(string? csv, TryParse<T> tryParse)
    {
        if (string.IsNullOrWhiteSpace(csv)) return [];

        var parsed = new List<T>();
        foreach (var token in csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (tryParse(token, out var value) && !parsed.Contains(value))
                parsed.Add(value);
        }

        return parsed;
    }

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
