namespace RealEstateEval.Domain;

/// <summary>
/// Issued Infath invoice for a work order (PO).
/// </summary>
public class PoEnfazInvoice
{
    public string PoNumber { get; set; } = "";
    public string InvoiceNumber { get; set; } = "";
    public DateTime IssuedAtUtc { get; set; }
}
