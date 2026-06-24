namespace RealEstateEval.Domain;

/// <summary>
/// Enfaz (Infath) revenue entered by finance per property within a work order.
/// </summary>
public class PoEnfazRevenueLine
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
    public decimal EnfazFeeSar { get; set; }
    public bool IncludedInBilling { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; }
}
