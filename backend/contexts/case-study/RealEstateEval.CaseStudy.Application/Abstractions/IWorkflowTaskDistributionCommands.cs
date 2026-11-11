using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;

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
    /// Spawns the engineering-survey child after distribution when none is live: for a property the
    /// survey rule asks one for, or — with a recorded reason — for one it does not (2026-11-11).
    /// </summary>
    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> AddEngineeringSurveyAsync(
        Guid id,
        AddEngineeringSurveyRequest request,
        StaffActor actor,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// «تجاوز المكتب الهندسي»: cancels the parent's open engineering-survey child — the study goes on
    /// without the office, which earns no fee. Answers the parent.
    /// </summary>
    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> SkipEngineeringSurveyAsync(
        Guid id,
        SkipEngineeringSurveyRequest request,
        StaffActor actor,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Updates case-study party assignment (existing subtasks) without fully reopening distribution.</summary>
    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RedistributePartiesAsync(
        Guid id,
        RedistributePartiesRequest request,
        StaffActor actor,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default);
}
