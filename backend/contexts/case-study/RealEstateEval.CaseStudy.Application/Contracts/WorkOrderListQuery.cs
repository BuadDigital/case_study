namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/work-orders</c>. Every member is
/// optional: an instance with no page and no page size keeps the legacy plain-array response.
/// See docs/architecture/pagination-contract.md.
/// </summary>
public sealed record WorkOrderListQuery
{
 /// <summary>1-based page number. Present (with or without <see cref="PageSize"/>) switches the
 /// endpoint to the paged envelope.</summary>
    public int? Page { get; init; }

    public int? PageSize { get; init; }

 /// <summary>Sort key from <c>WorkOrderListQueryRules.AllowedSortKeys</c>; unknown falls back.</summary>
    public string? Sort { get; init; }

 /// <summary><c>asc</c> or <c>desc</c>; anything else falls back to the per-endpoint default.</summary>
    public string? Dir { get; init; }

 /// <summary>Free text over PO number, deed / real-estate registration number, assignment type
 /// label, and assignment specialist.</summary>
    public string? Q { get; init; }

 /// <summary>PO list status bucket. Billing buckets widen to their study equivalent.</summary>
    public string? Status { get; init; }

 /// <summary>Assignment-type label (تنفيذ / تركات / قطاع خاص).</summary>
    public string? Type { get; init; }

 /// <summary>No paging, no filters, default sort — the legacy list shape.</summary>
    public static WorkOrderListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
