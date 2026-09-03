using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the workflow-task lifecycle commands: advance, revert, cancel,
/// reopen, and the PO / property deletions. Only the Infrastructure adapter opens EF. Reads are
/// untracked unless the method name says <c>ForUpdate</c>.
/// </summary>
public interface IWorkflowTaskLifecycleRepository
{
    Task<WorkflowTask?> GetTaskForUpdateAsync(Guid taskId, CancellationToken cancellationToken);

    Task<WorkOrderProperty?> GetPropertyAsync(Guid propertyId, CancellationToken cancellationToken);

    Task<WorkOrderProperty?> GetPropertyForUpdateAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    Task<List<WorkflowTask>> ListChildrenForUpdateAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    /// <summary>Every task on the PO, tracked so the caller can remove or reset them.</summary>
    Task<List<WorkflowTask>> ListTasksForPoForUpdateAsync(
        string poNumber,
        CancellationToken cancellationToken);

    /// <summary>The work order with its properties, tracked.</summary>
    Task<WorkOrder?> GetWorkOrderWithPropertiesForUpdateAsync(
        string poNumber,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PartyTaskSubmission>> ListSubmissionsForUpdateAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    void RemoveTasks(IReadOnlyCollection<WorkflowTask> tasks);

    void RemoveSubmissions(IReadOnlyCollection<PartyTaskSubmission> submissions);

    /// <summary>Deletes the field-inspection workspaces of the given tasks straight away.</summary>
    Task DeleteFieldInspectionWorkspacesAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>Runs the action in a database transaction where the provider supports one.</summary>
    Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken);
}
