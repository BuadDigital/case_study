using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the workflow-task distribution commands: the parent task and its
/// party children, plus the property rows the notifications quote. Only the Infrastructure
/// adapter opens EF. Reads are untracked unless the method says otherwise.
/// </summary>
public interface IWorkflowTaskDistributionRepository
{
    /// <summary>Tracked task; edits are persisted by <see cref="SaveChangesAsync"/>.</summary>
    Task<WorkflowTask?> GetTaskForUpdateAsync(Guid taskId, CancellationToken cancellationToken);

    /// <summary>Tracked children of the parent task.</summary>
    Task<List<WorkflowTask>> ListChildrenForUpdateAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    Task<WorkOrderProperty?> GetPropertyAsync(Guid propertyId, CancellationToken cancellationToken);

    void AddTasks(IReadOnlyCollection<WorkflowTask> tasks);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
