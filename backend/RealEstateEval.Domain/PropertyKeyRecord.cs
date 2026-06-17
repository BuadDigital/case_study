namespace RealEstateEval.Domain;

public class PropertyKeyRecord
{
    public Guid Id { get; set; }
    public string PropertyId { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string Area { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public bool HasKey { get; set; }
    public string Specialist { get; set; } = "";
    public string WorkflowStatus { get; set; } = "progress";
    public DateTime UpdatedAtUtc { get; set; }
}
