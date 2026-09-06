namespace RealEstateEval.Application.Contracts;

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/party-billing-statements</c>.
/// Every member is optional: with no page and no page size the endpoint keeps its plain array.
/// Lives in the shared Application assembly because the Case Study host forwards it over HTTP to
/// the Financial owner. See docs/architecture/pagination-contract.md §9.1.
/// </summary>
public sealed record PartyBillingStatementListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

    /// <summary>Sort key from <c>PartyBillingStatementListQueryRules.AllowedSortKeys</c>; unknown falls back.</summary>
    public string? Sort { get; init; }

    /// <summary><c>asc</c> or <c>desc</c>; anything else falls back to <c>desc</c>.</summary>
    public string? Dir { get; init; }

    /// <summary>Free text over reference number, vendor invoice number, disbursement voucher and transfer reference.</summary>
    public string? Q { get; init; }

    /// <summary>Exact payee (distribution assignee id). <b>Unchanged from before this contract.</b></summary>
    public string? AssigneeId { get; init; }

    /// <summary>Comma-separated persisted statuses. A single value is the exact match the endpoint always had.</summary>
    public string? Status { get; init; }

    /// <summary>Only issued / invoice-received / closed statements. <b>Unchanged.</b></summary>
    public bool IssuedOrLaterOnly { get; init; }

    public static PartyBillingStatementListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/party-billing-statements/ready-lines</c>.
/// The row set is synthesised (ledgers minus claimed lines, one per task, plus court-visit
/// charges), so the page is cut over the materialised list — see the contract, §9.2.
/// </summary>
public sealed record PartyBillingReadyLineListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

    public string? Sort { get; init; }

    public string? Dir { get; init; }

    /// <summary>Free text over property label, PO number and workflow task id.</summary>
    public string? Q { get; init; }

    /// <summary>Exact payee (distribution assignee id). <b>Unchanged.</b></summary>
    public string? AssigneeId { get; init; }

    public static PartyBillingReadyLineListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/enfaz-billing/ready-pos-summary</c>.
/// See docs/architecture/pagination-contract.md §10.1.
/// </summary>
public sealed record EnfazReadyPoListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

    public string? Sort { get; init; }

    public string? Dir { get; init; }

    /// <summary>Free text over the PO number.</summary>
    public string? Q { get; init; }

    public static EnfazReadyPoListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}

/// <summary>
/// Server-side paging / filtering / sorting for <c>GET /api/enfaz-billing/tracking</c>.
/// See docs/architecture/pagination-contract.md §10.2.
/// </summary>
public sealed record EnfazTrackingListQuery
{
    public int? Page { get; init; }

    public int? PageSize { get; init; }

    public string? Sort { get; init; }

    public string? Dir { get; init; }

    /// <summary>Free text over PO number, deed number, property label, city and invoice number.</summary>
    public string? Q { get; init; }

    public static EnfazTrackingListQuery Empty { get; } = new();

    public bool IsPaged => Page.HasValue || PageSize.HasValue;
}
