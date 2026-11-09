namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>Derived transaction status — network of stages, parties and “who is waiting for whom”.</summary>
public class TransactionStageStateDto
{
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    public required string Status { get; init; }
    public required string StatusLabelAr { get; init; }
}

public class TransactionPartyStateDto
{
    public required string Key { get; init; }
    public required string LabelAr { get; init; }
    public required string Status { get; init; }
    public required string StatusLabelAr { get; init; }
    public IReadOnlyList<string> WaitingOn { get; init; } = [];
    public IReadOnlyList<string> WaitingOnLabelsAr { get; init; } = [];
}

public class TransactionStateDto
{
    public Guid WorkOrderId { get; init; }
    public Guid PropertyId { get; init; }
    public IReadOnlyList<TransactionStageStateDto> Stages { get; init; } = [];
    public IReadOnlyList<TransactionPartyStateDto> Parties { get; init; } = [];
    public required string OverallStatus { get; init; }
    public required string OverallStatusLabelAr { get; init; }
    public string WaitingSummaryAr { get; init; } = "";

 /// <summary>The second conclusion is ready: Deposit Certificate issued and all terminals completed.</summary>
    public bool AllowsEnfazHandover { get; init; }
 /// <summary>The specialist issued the case-study report (a precondition of the handover).</summary>
    public bool StudyReportIssued { get; init; }
 /// <summary>What still blocks the handover, in Arabic; empty when it is allowed.</summary>
    public IReadOnlyList<string> EnfazBlockReasonsAr { get; init; } = [];
 /// <summary>
 /// Only on the answer of <c>enfaz-return</c>: what was done per part — the study report, and why
 /// the valuation part is (or is not) reopened by this call.
 /// </summary>
    public IReadOnlyList<string> EnfazReturnNoticesAr { get; init; } = [];
    public string? EnfazHandoverAtUtc { get; init; }
 /// <summary>
 /// When the accountant marked the deed «جاهز للفوترة» (its financial data appeared on Enfaz); null
 /// when not marked. A marked deed is no longer taken back from Enfaz.
 /// </summary>
    public string? BillingReadyAtUtc { get; init; }
 /// <summary>
 /// When review pressed «تجهيز المعاملة للرفع» after checking the upload package (Omar 2026-11-08); null
 /// until then. «تم الرفع على إنفاذ» is refused before it.
 /// </summary>
    public string? ReadyForUploadAtUtc { get; init; }
 /// <summary>Enfaz upload package.</summary>
    public IReadOnlyList<string> HandoverPackageAr { get; init; } = [];

    /// <summary>The transaction's active reopening (open, or awaiting the reply to Enfaz); null when none.</summary>
    public TransactionReopeningDto? Reopening { get; set; }

    /// <summary>
    /// «إعادة فتح المعاملة» is open now (Omar 2026-11-05): the valuation deposited or the transaction uploaded,
    /// no reopening active, not marked ready for billing.
    /// </summary>
    public bool CanReopen { get; set; }
}

/// <summary>One «إعادة فتح المعاملة», as the screens show it.</summary>
public class TransactionReopeningDto
{
    public Guid Id { get; init; }
    public Guid TransactionId { get; init; }
    public Guid PropertyId { get; init; }
    /// <summary>enfaz | internal.</summary>
    public string Source { get; init; } = "";
    public string SourceLabelAr { get; init; } = "";
    public string? EnfazReference { get; init; }
    public string Reason { get; init; } = "";
    public bool ReopensStudy { get; init; }
    public bool ReopensValuation { get; init; }
    public bool NeedsFieldWork { get; init; }
    public string AffectedLabelAr { get; init; } = "";
    /// <summary>open | awaiting_reply | closed.</summary>
    public string Status { get; init; } = "";
    public string OpenedAtUtc { get; init; } = "";
    public string? OpenedByName { get; init; }
    public string? UploadedAgainAtUtc { get; init; }
}



/// <summary>
/// The case specialist takes a handed-over transaction back from Enfaz. Validated by the service
/// with Arabic messages (plain attributes would leak raw English): a reason of at least 10
/// characters and at least one of the two reopen choices.
/// </summary>
public class ReturnFromEnfazRequest
{
    public string? Reason { get; init; }
    public bool ReopenStudy { get; init; }
    public bool ReopenValuation { get; init; }

    /// <summary>enfaz (default, the old «إعادة من إنفاذ») | internal (Omar 2026-11-05).</summary>
    public string? Source { get; init; }

    /// <summary>Enfaz's reference for its note, when the reopening came from Enfaz.</summary>
    public string? EnfazReference { get; init; }

    /// <summary>Field work is needed — the study is reopened and the screen offers a task for it.</summary>
    public bool NeedsFieldWork { get; init; }
}
