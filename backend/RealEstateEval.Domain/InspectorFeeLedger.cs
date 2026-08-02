namespace RealEstateEval.Domain;

/// <summary>
/// Per-property party fee row.
/// Field-inspection / government-review: created when case-study completes.
/// Engineering-survey: accrued when the specialist accepts survey outputs (not on upload alone).
/// </summary>
public class InspectorFeeLedger
{
    /// <summary>Independent ledger identity (ج٨). Accrual still keys lookups by <see cref="WorkflowTaskId"/>.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Work-order id for the transaction. Unique with <see cref="DeedId"/> and <see cref="UserId"/>.</summary>
    public Guid TransactionId { get; set; }

    /// <summary>
    /// Deed/property id. Until PO-level tasks are split, a task without <see cref="PropertyId"/>
    /// uses <see cref="WorkflowTaskId"/> as a stand-in so the unique triple still holds.
    /// </summary>
    public Guid DeedId { get; set; }

    /// <summary>Fee owner — same value as <see cref="AssigneeId"/> when present.</summary>
    public string UserId { get; set; } = "";

    public Guid WorkflowTaskId { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
    public int PropertyOrdinal { get; set; } = 1;
    public string? AssigneeId { get; set; }
    /// <summary>متعاون فرد | متعاون شركة | موظف (أو متعاون قديم)</summary>
    public string InspectorType { get; set; } = "موظف";
    /// <summary>The transaction department whose supervisor owns discount and dispute decisions.</summary>
    public string SupervisingDepartment { get; set; } = SupervisingDepartments.CaseStudy;
    public decimal AgreedFeeSar { get; set; }
    /// <summary>
    /// The <c>PartyFeePricingTable</c> the agreed fee was read from, stamped alongside the amount.
    /// Null when nothing priced it: an employee's fee is entered by hand. Deliberately not a foreign
    /// key — pricing lives in another context, and the id has to keep naming its source even in rows
    /// whose table has since been removed.
    /// </summary>
    public Guid? PricingTableId { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    /// <summary>
    /// draft | office-review | disputed | sup-review | at-finance | deferred |
    /// in-statement | disb-req | disbursed | returned | inquiry | suspended
    /// </summary>
    public string BillingStatus { get; set; } = InspectorFeeBillingStatus.Draft;
    /// <summary>
    /// The status the line was withheld from, so lifting a suspension restores it exactly instead of
    /// promoting a draft straight to finance. Set only while <see cref="BillingStatus"/> is suspended.
    /// </summary>
    public string? PreSuspensionStatus { get; set; }
    /// <summary>Why the supervisor withheld the line. Required to suspend.</summary>
    public string? SuspensionReason { get; set; }
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
