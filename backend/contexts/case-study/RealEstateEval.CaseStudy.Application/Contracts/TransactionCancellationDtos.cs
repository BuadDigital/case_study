namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// «إلغاء المعاملة» request: one transaction (any of its deeds names it) or every live
/// transaction of one work order. Fields are validated by the service with Arabic messages.
/// </summary>
public class RequestTransactionCancellationRequest
{
    /// <summary>Any deed of the transaction to cancel (transaction scope).</summary>
    public Guid? PropertyId { get; init; }

    /// <summary>The work order whose live transactions are all cancelled (work-order scope).</summary>
    public string? PoNumber { get; init; }

    /// <summary>duplicate | wrong_entry | other.</summary>
    public string ReasonCode { get; init; } = "";

    public string Note { get; init; } = "";

    /// <summary>Optional supporting file already uploaded to the attachments service.</summary>
    public Guid? AttachmentId { get; init; }
}

/// <summary>The supervisor's approve / reject; the note is optional on both.</summary>
public class DecideTransactionCancellationRequest
{
    public string? Note { get; init; }
}

/// <summary>The supervisor's reactivation of a cancelled transaction; the reason is required.</summary>
public class ReactivateTransactionCancellationRequest
{
    public string Note { get; init; } = "";
}

/// <summary>One deed a cancellation covers, or would cover — with why it cannot when it cannot.</summary>
public class TransactionCancellationDeedDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string DeedNumber { get; init; } = "";
    public Guid TransactionId { get; init; }
    public string TransactionNumber { get; init; } = "";

    /// <summary>Null when the deed can be cancelled; otherwise the Arabic reason it is left out.</summary>
    public string? BlockedReason { get; init; }
}

/// <summary>What a request would cancel — shown in the dialog before anything is sent.</summary>
public class TransactionCancellationPreviewDto
{
    public string Scope { get; init; } = "";
    public string ScopeRef { get; init; } = "";
    public string PoNumber { get; init; } = "";

    /// <summary>The deeds that will be cancelled.</summary>
    public IReadOnlyList<TransactionCancellationDeedDto> Deeds { get; init; } = [];

    /// <summary>Deeds left out, each with its reason.</summary>
    public IReadOnlyList<TransactionCancellationDeedDto> Excluded { get; init; } = [];
}

public class TransactionCancellationDto
{
    public Guid Id { get; init; }
    public string Scope { get; init; } = "";
    public string ScopeRef { get; init; } = "";
    public string PoNumber { get; init; } = "";

    /// <summary>pending | approved | rejected | reactivated.</summary>
    public string Status { get; init; } = "";

    public string ReasonCode { get; init; } = "";
    public string ReasonLabel { get; init; } = "";
    public string Note { get; init; } = "";
    public Guid? AttachmentId { get; init; }
    public IReadOnlyList<TransactionCancellationDeedDto> Deeds { get; init; } = [];
    public string RequestedByName { get; init; } = "";
    public DateTime RequestedAtUtc { get; init; }
    public string? DecidedByName { get; init; }
    public DateTime? DecidedAtUtc { get; init; }
    public string? DecisionNote { get; init; }
    public string? ReactivatedByName { get; init; }
    public DateTime? ReactivatedAtUtc { get; init; }
    public string? ReactivationNote { get; init; }
}

/// <summary>A deed's cancellation state for the property page: a pending request, the approved one, or neither.</summary>
public class TransactionCancellationStateDto
{
    public TransactionCancellationDto? Pending { get; init; }
    public TransactionCancellationDto? Cancelled { get; init; }
}

/// <summary>Who acts on a cancellation — resolved by the controller from the caller's claims and permissions.</summary>
public sealed record TransactionCancellationActor(string UserId, string Name, string? Role);
