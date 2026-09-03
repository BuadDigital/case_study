namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Clears everything hanging off a set of workflow tasks when the lifecycle reverts, cancels,
/// or deletes them: party submissions, inspector fee ledgers, and field-inspection workspaces.
/// Staged with the caller's unit of work where the store allows it; only the Infrastructure
/// adapter opens EF.
/// </summary>
public interface IWorkflowTaskCascadeCleanup
{
    Task RemovePartySubmissionsForTasksAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken);
}
