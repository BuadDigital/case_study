namespace RealEstateEval.Domain;

/// <summary>Audit log for inspector fee billing status changes.</summary>
public class InspectorFeeTransition
{
    public Guid Id { get; set; }
    public Guid WorkflowTaskId { get; set; }
    public string FromStatus { get; set; } = "";
    public string ToStatus { get; set; } = "";
    public string? Reason { get; set; }
    public string ActorUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
