namespace RealEstateEval.Domain;

/// <summary>
/// Per-property party fee row — created when field-inspection or engineering-survey task is spawned.
/// </summary>
public class InspectorFeeLedger
{
    public Guid WorkflowTaskId { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
    public int PropertyOrdinal { get; set; } = 1;
    public string? AssigneeId { get; set; }
    /// <summary>متعاون فرد | متعاون شركة | موظف (أو متعاون قديم)</summary>
    public string InspectorType { get; set; } = "موظف";
    public decimal AgreedFeeSar { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    /// <summary>draft | sup-review | at-finance | disb-req | disbursed | returned | inquiry</summary>
    public string BillingStatus { get; set; } = InspectorFeeBillingStatus.Draft;
    public bool ExcludedFromBatch { get; set; }
    public string? ExclusionReason { get; set; }
    /// <summary>supervisor | office — set when status is returned or inquiry.</summary>
    public string? ReturnTo { get; set; }
    public Guid? DisbursementBatchId { get; set; }
    public string? DisbursementVoucher { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
