using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

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
            string? actorUserId = null,
            CancellationToken cancellationToken = default);

    /// <summary>
    /// Spawns the engineering-survey child after distribution when the property now needs a survey
    /// (the inspector's corrected type) and none is live.
    /// </summary>
    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> AddEngineeringSurveyAsync(
        Guid id,
        AddEngineeringSurveyRequest request,
        string actorRole,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Updates case-study party assignment (existing subtasks) without fully reopening distribution.</summary>
    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RedistributePartiesAsync(
        Guid id,
        RedistributePartiesRequest request,
        string actorRole,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);
}
