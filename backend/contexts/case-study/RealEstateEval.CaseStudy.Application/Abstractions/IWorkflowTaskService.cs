using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>The workflow-task façade: query, distribution and lifecycle, plus the slot sync.</summary>
public interface IWorkflowTaskService
    : IWorkflowTaskQuery, IWorkflowTaskDistributionCommands, IWorkflowTaskLifecycleCommands
{
    Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(CancellationToken cancellationToken = default);
}
