namespace RealEstateEval.Domain;

public class ValuationRequest
{
    public Guid Id { get; set; }
    public string DisplayId { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string Area { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string Appraiser { get; set; } = "";
    /// <summary>done | progress</summary>
    public string Status { get; set; } = "progress";
    public string RequestDate { get; set; } = "";
    public DateTime UpdatedAtUtc { get; set; }
}
