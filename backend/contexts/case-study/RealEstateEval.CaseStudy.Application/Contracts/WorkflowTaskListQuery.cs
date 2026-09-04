namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/workflow-tasks</c>. Every member is
/// optional: an instance with no page and no page size keeps the legacy plain-array response.
/// See docs/architecture/pagination-contract.md.
/// </summary>
public sealed record WorkflowTaskListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

 /// <summary>Sort key from <c>WorkflowTaskListQueryRules.AllowedSortKeys</c>; unknown falls back.</summary>
    public string? Sort { get; init; }

    public string? Dir { get; init; }

 /// <summary>Free text over PO number, title, assignee name and the task's assignment type.</summary>
    public string? Q { get; init; }

 /// <summary>Comma-separated task kinds (<c>field-inspection,engineering-survey</c>).</summary>
    public string? Kind { get; init; }

 /// <summary>Comma-separated task statuses (<c>open,blocked</c>).</summary>
    public string? Status { get; init; }

 /// <summary>Comma-separated case-study phases (<c>bourse,distribution</c>).</summary>
    public string? Phase { get; init; }

 /// <summary>Exact distribution assignee id.</summary>
    public string? AssigneeId { get; init; }

 /// <summary>Exact assignee role (case-insensitive).</summary>
    public string? AssigneeRole { get; init; }

 /// <summary>Exact PO number.</summary>
    public string? PoNumber { get; init; }

 /// <summary>Exact assignment-type label carried on the task row.</summary>
    public string? AssignmentType { get; init; }

    public static WorkflowTaskListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
