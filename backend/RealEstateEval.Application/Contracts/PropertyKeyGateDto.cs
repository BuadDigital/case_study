namespace RealEstateEval.Application.Contracts;

/// <summary>Projection of envelope/court-access state into legacy queue gates.</summary>
public sealed class PropertyKeyGateDto
{
    public Guid? PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string DeedNumber { get; init; } = "";
    public string RequestNumber { get; init; } = "";
    /// <summary>received | pending | not_required | ""</summary>
    public string KeysStatus { get; init; } = "";
    /// <summary>yes | no | ""</summary>
    public string KeyHandedToInspector { get; init; } = "";
    public bool KeyAvailable { get; init; }
    /// <summary>envelope | court_access | legacy | none</summary>
    public string Source { get; init; } = "none";
    public Guid? EnvelopeId { get; init; }
    public Guid? AssignmentId { get; init; }
    public string? AssignmentStatus { get; init; }
    public Guid? PendingHandoffId { get; init; }
    public string StudyHoldStatus { get; init; } = "none";
    public bool EnvelopeMissingWarning { get; init; }
}
