using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Keeps case-study property slots aligned with work-order expected counts.</summary>
public interface IWorkflowTaskSlotSynchronizer
{
    Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Aligns every work order's slots without listing the tasks afterwards — the background
    /// sweep's safety net (<c>WorkflowTaskSlotSweepHostedService</c>).
    /// </summary>
    Task SyncAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Aligns one work order's slots with its deeds and expected count — called by every save that
    /// changes a work order or its deeds (2026-11-19: this used to happen when someone READ the work
    /// orders, over every order and every task, up to once a minute per open staff tab).
    /// </summary>
    Task SyncPoAsync(string poNumber, CancellationToken cancellationToken = default);

    void SyncPoSlots(WorkOrder order, List<WorkflowTask> allTasks);
}
