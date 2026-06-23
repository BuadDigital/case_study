using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IInspectorFeeService
{
    Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> fieldInspectionTasks,
        CancellationToken cancellationToken = default);

    Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        CancellationToken cancellationToken = default);

    Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default);

    Task<InspectorFeeRowDto?> PatchAsync(
        Guid workflowTaskId,
        PatchInspectorFeeRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default);
}
