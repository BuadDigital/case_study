namespace RealEstateEval.Domain;

/// <summary>
/// Per-property party fee row.
/// Field-inspection / government-review: created when case-study completes.
/// Engineering-survey: accrued when the specialist accepts survey outputs (not on upload alone).
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
    /// <summary>
    /// draft | office-review | disputed | sup-review | at-finance | deferred |
    /// in-statement | disb-req | disbursed | returned | inquiry
    /// </summary>
    public string BillingStatus { get; set; } = InspectorFeeBillingStatus.Draft;
    public bool ExcludedFromBatch { get; set; }
    public string? ExclusionReason { get; set; }
    /// <summary>supervisor | office — set when status is returned or inquiry.</summary>
    public string? ReturnTo { get; set; }
    public Guid? DisbursementBatchId { get; set; }
    public string? DisbursementVoucher { get; set; }
    /// <summary>Engineering-office monthly billing statement membership (stages 6–8).</summary>
    public Guid? EngineeringBillingStatementId { get; set; }
    /// <summary>
    /// When the engineering-office fee became payable (specialist acceptance).
    /// Null until acceptance; re-uploads after accrual do not create a new fee.
    /// </summary>
    public DateTime? AccruedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
