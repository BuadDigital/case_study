namespace RealEstateEval.Domain;

public class EvaluatorRecallRecord
{
    public Guid Id { get; set; }
    public string TaskId { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    /// <summary>pending | approved | rejected</summary>
    public string Status { get; set; } = "pending";
    public string Reason { get; set; } = "";
    public string SpecialistNote { get; set; } = "";
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
}
