namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>Q-9: Derived transaction status — network of stages, parties and “who is waiting for whom”.</summary>
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
    public string? EnfazHandoverAtUtc { get; init; }
 /// <summary>Enfaz upload package (Q-9/Q-14).</summary>
    public IReadOnlyList<string> HandoverPackageAr { get; init; } = [];
}

/// <summary>
/// Q-9 supplement (R3): after the Enfaz upload, the system does not reopen anything automatically — the General Manager records
/// Decision (official Enfaz channel) is under review only; Actual retrieval from Enfaz goes through R2.
/// </summary>
public class PostEnfazDecisionRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(256)]
    public string Decision { get; init; } = "";

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(1024)]
    public string Reason { get; init; } = "";
}
