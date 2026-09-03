namespace RealEstateEval.Financial.Domain;

/// <summary>
/// Issued Infath invoice for a work order (PO), with collection tracking.
/// </summary>
public class PoEnfazInvoice
{
    public string PoNumber { get; set; } = "";
    public string InvoiceNumber { get; set; } = "";
    public DateTime IssuedAtUtc { get; set; }

 /// <summary>issued | partially_collected | collected</summary>
    public string Status { get; set; } = PoEnfazInvoiceStatus.Issued;
    public decimal SubtotalSar { get; set; }
    public decimal VatSar { get; set; }
    public decimal TotalSar { get; set; }
    public decimal CollectedAmountSar { get; set; }
    public DateTime? CollectedAtUtc { get; set; }
 /// <summary>Optional attachment ids (JSON array of Guid strings).</summary>
    public string? AttachmentIdsJson { get; set; }
}

public static class PoEnfazInvoiceStatus
{
    public const string Issued = "issued";
    public const string PartiallyCollected = "partially_collected";
    public const string Collected = "collected";
}
