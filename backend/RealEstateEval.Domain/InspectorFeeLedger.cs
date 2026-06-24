namespace RealEstateEval.Domain;

/// <summary>
/// Per-property inspector fee row — created when field-inspection workflow task is spawned.
/// Supervisor adjusts discount and billing status before invoicing.
/// </summary>
public class InspectorFeeLedger
{
    public Guid WorkflowTaskId { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
    public int PropertyOrdinal { get; set; } = 1;
    public string? AssigneeId { get; set; }
    /// <summary>متعاون | موظف</summary>
    public string InspectorType { get; set; } = "موظف";
    public decimal AgreedFeeSar { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    /// <summary>pre-billing | ready-for-billing | invoiced | paid | returned</summary>
    public string BillingStatus { get; set; } = InspectorFeeBillingStatus.PreBilling;
    public bool ExcludedFromBatch { get; set; }
    public string? ExclusionReason { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
