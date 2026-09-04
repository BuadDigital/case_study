namespace RealEstateEval.Failures.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/failures</c>. Every member is optional:
/// an instance with no page and no page size keeps the legacy plain-array response.
/// See docs/architecture/pagination-contract.md §5.
/// </summary>
public sealed record FailureListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

 /// <summary>Sort key from <c>FailureListQueryRules.AllowedSortKeys</c>; unknown falls back.</summary>
    public string? Sort { get; init; }

    public string? Dir { get; init; }

 /// <summary>Free text over PO number, deed number, title and specialist.</summary>
    public string? Q { get; init; }

 /// <summary>Comma-separated persisted statuses (<c>internal,review</c>).</summary>
    public string? Status { get; init; }

 /// <summary>Exact PO number.</summary>
    public string? PoNumber { get; init; }

 /// <summary>Exact problem-type id.</summary>
    public string? ProblemTypeId { get; init; }

    public static FailureListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
