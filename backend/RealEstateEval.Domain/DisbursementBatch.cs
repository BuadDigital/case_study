namespace RealEstateEval.Domain;

/// <summary>
/// Office-created batch grouping properties ready for finance disbursement.
/// </summary>
public class DisbursementBatch
{
    public Guid Id { get; set; }
    public string AssigneeId { get; set; } = "";
    public string CreatedByUserId { get; set; } = "";
    public decimal TotalNetSar { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
