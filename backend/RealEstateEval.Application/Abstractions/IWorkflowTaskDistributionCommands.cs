using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IWorkflowTaskDistributionCommands
{
    Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default);

    Task<(ConfirmTaskDistributionResponseDto? Result, IReadOnlyDictionary<string, string>? Errors)>
        ConfirmDistributionAsync(
            Guid id,
            ConfirmTaskDistributionRequest request,
            CancellationToken cancellationToken = default);

    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RedistributePartiesAsync(
        Guid id,
        RedistributePartiesRequest request,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default);
}
