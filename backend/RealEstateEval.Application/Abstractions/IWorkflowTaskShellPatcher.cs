using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Applies a shell patch to a workflow task without case-study fee / cascade collaborators.
/// Used by Failures (A6 pure host) and the residual lifecycle façade.
/// </summary>
public interface IWorkflowTaskShellPatcher
{
    Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default);
}
