namespace RealEstateEval.Operations.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/operations-tasks</c>. Every member is
/// optional: an instance with no page and no page size keeps the legacy plain-array response, and
/// <see cref="AssigneeId"/> / <see cref="CreatedBy"/> / <see cref="Status"/> keep the semantics the
/// endpoint already had. See docs/architecture/pagination-contract.md.
/// </summary>
public sealed record OperationsTaskListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

 /// <summary>Sort key from <c>OperationsTaskListQueryRules.AllowedSortKeys</c>; unknown falls back.</summary>
    public string? Sort { get; init; }

    public string? Dir { get; init; }

 /// <summary>Free text over title, display id, assignee name, PO number and letter reference.</summary>
    public string? Q { get; init; }

 /// <summary>Exact assignee id (unchanged from the pre-paging endpoint).</summary>
    public string? AssigneeId { get; init; }

 /// <summary>Exact creator user id (unchanged from the pre-paging endpoint).</summary>
    public string? CreatedBy { get; init; }

 /// <summary>Single status. An unrecognised value still matches nothing, as before.</summary>
    public string? Status { get; init; }

 /// <summary>Task scope (general / transaction / work_order / multi).</summary>
    public string? Scope { get; init; }

 /// <summary>Task type (general / court_visit / reshoot / field_visit / inquiry).</summary>
    public string? Type { get; init; }

 /// <summary>Keep only created / in progress — the screen's "show all" toggle turned off.</summary>
    public bool? ActiveOnly { get; init; }

 /// <summary>Drop rows parked on an active property failure (executor queues).</summary>
    public bool? ExcludeFailurePaused { get; init; }

    public static OperationsTaskListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
