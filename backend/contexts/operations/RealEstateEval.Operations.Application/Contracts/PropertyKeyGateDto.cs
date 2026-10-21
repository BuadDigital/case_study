using RealEstateEval.Domain;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Contracts;

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
    public string Source { get; init; } = PropertyKeyGateSources.None;
    public Guid? EnvelopeId { get; init; }
    public Guid? AssignmentId { get; init; }
    public string? AssignmentStatus { get; init; }
    public Guid? PendingHandoffId { get; init; }
    public string StudyHoldStatus { get; init; } = PropertyCourtAccessStatuses.None;
    public bool EnvelopeMissingWarning { get; init; }

    // Custody (decision 2026-10-20): who holds the envelope and where this deed's key is. The
    // screen compares the holder with the deed's own inspector — operations cannot see tasks.
    public string? EnvelopeHolderKind { get; init; }
    public string? EnvelopeHolderUserId { get; init; }
    public string? EnvelopeHolderLabel { get; init; }
    public string? KeyLocation { get; init; }
    public string? KeyHolderUserId { get; init; }
    public string? KeyHolderLabel { get; init; }
}
