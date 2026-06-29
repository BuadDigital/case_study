using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IWorkflowTaskService
{
    Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(CancellationToken cancellationToken = default);
    Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default);
    Task<ConfirmTaskDistributionResponseDto> ConfirmDistributionAsync(
        Guid id,
        ConfirmTaskDistributionRequest request,
        CancellationToken cancellationToken = default);
    Task<WorkflowTaskDto?> AdvanceAfterEnfathAsync(
        Guid id,
        AdvanceTaskAfterEnfathRequest request,
        CancellationToken cancellationToken = default);
    Task<WorkflowTaskDto?> AdvanceAfterBourseAsync(
        Guid id,
        AdvanceTaskAfterBourseRequest request,
        CancellationToken cancellationToken = default);
    Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default);
    Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default);
    Task DeleteForPropertyAsync(
        string poNumber,
        Guid propertyId,
        int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default);
}
