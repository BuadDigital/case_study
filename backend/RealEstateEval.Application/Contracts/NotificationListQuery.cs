namespace RealEstateEval.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/notifications</c>. Every member is
/// optional: an instance with no page and no page size keeps the legacy plain-array response,
/// capped at the feed's own 50 rows. See docs/architecture/pagination-contract.md §6.
/// </summary>
public sealed record NotificationListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

 /// <summary>Only <c>created</c> is meaningful; unknown falls back to it.</summary>
    public string? Sort { get; init; }

    public string? Dir { get; init; }

 /// <summary>Free text over title and body.</summary>
    public string? Q { get; init; }

 /// <summary>Exact category.</summary>
    public string? Category { get; init; }

 /// <summary><c>true</c> unread only, <c>false</c> read only, omitted for both.</summary>
    public bool? Unread { get; init; }

    public static NotificationListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
