using RealEstateEval.Domain;

namespace RealEstateEval.Operations.Domain;

public class PropertyKeyRecord
{
    public Guid Id { get; set; }
    public string PropertyId { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string Area { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public bool HasKey { get; set; }
    public string Specialist { get; set; } = "";
    public string WorkflowStatus { get; set; } = PropertyKeyWorkflowStatuses.Progress;
    public DateTime UpdatedAtUtc { get; set; }
}
