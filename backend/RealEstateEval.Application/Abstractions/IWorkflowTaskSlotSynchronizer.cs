using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>Keeps case-study property slots aligned with work-order expected counts.</summary>
public interface IWorkflowTaskSlotSynchronizer
{
    Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(
        CancellationToken cancellationToken = default);

    void SyncPoSlots(WorkOrder order, List<WorkflowTask> allTasks);
}
