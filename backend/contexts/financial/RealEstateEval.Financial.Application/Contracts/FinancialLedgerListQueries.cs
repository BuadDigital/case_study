namespace RealEstateEval.Financial.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/financial/incentive-suspensions</c>.
/// Every member is optional: with no page and no page size the endpoint keeps its plain array.
/// See docs/architecture/pagination-contract.md §7.
/// </summary>
public sealed record IncentiveSuspensionListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

    public string? Sort { get; init; }

    public string? Dir { get; init; }

 /// <summary>Free text over transaction key, assignee id and reason.</summary>
    public string? Q { get; init; }

 /// <summary>Exact transaction key. <b>Unchanged from before this contract.</b></summary>
    public string? TransactionKey { get; init; }

 /// <summary>Exact distribution assignee id. <b>Unchanged.</b></summary>
    public string? AssigneeId { get; init; }

 /// <summary>Default <c>true</c>: only suspensions that have not been lifted. <b>Unchanged.</b></summary>
    public bool ActiveOnly { get; init; } = true;

    public static IncentiveSuspensionListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/financial/discount-flags</c>.
/// See docs/architecture/pagination-contract.md §7.
/// </summary>
public sealed record DiscountFlagListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

    public string? Sort { get; init; }

    public string? Dir { get; init; }

 /// <summary>Free text over transaction key, target assignee id and reason.</summary>
    public string? Q { get; init; }

 /// <summary>Exact transaction key. <b>Unchanged from before this contract.</b></summary>
    public string? TransactionKey { get; init; }

 /// <summary>Exact status (<c>pending</c> / <c>approved</c> / <c>rejected</c>). <b>Unchanged.</b></summary>
    public string? Status { get; init; }

    public static DiscountFlagListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
