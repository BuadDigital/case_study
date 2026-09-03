using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the work-order to workflow-task slot synchroniser. The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// </summary>
public interface IWorkflowTaskSlotRepository
{
    /// <summary>Untracked work orders with their properties loaded.</summary>
    Task<IReadOnlyList<WorkOrder>> ListWorkOrdersWithPropertiesAsync(
        CancellationToken cancellationToken);

    /// <summary>
    /// Tracked workflow tasks on any of <paramref name="poNumbers"/>. Edits to the returned
    /// entities are persisted by <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<List<WorkflowTask>> ListTasksForPoNumbersAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken);

    void AddTask(WorkflowTask task);

    /// <summary>
    /// Persists the pending changes. Returns false when a concurrency conflict lost the race —
    /// the pending tracked state is dropped so the caller can retry against fresh rows.
    /// </summary>
    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
