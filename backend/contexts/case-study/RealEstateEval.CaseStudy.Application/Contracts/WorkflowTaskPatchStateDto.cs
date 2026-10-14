using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>
/// The three facts the generic task patch needs to refuse a transition that belongs to another
/// action (a case-study parent is completed by issuing its report, never by a patch).
/// </summary>
public sealed class WorkflowTaskPatchStateDto
{
    public WorkflowTaskKind Kind { get; init; }
    public WorkflowTaskStatus Status { get; init; }
    public WorkflowTaskPhase Phase { get; init; }
}
