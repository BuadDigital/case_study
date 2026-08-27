using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IWorkflowTaskLifecycleCommands
{
    Task<WorkflowTaskDto?> AdvanceAfterEnfathAsync(
        Guid id,
        AdvanceTaskAfterEnfathRequest request,
        CancellationToken cancellationToken = default);

    Task<WorkflowTaskDto?> AdvanceAfterBourseAsync(
        Guid id,
        AdvanceTaskAfterBourseRequest request,
        CancellationToken cancellationToken = default);

    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RevertPhaseAsync(
        Guid id,
        RevertWorkflowTaskPhaseRequest request,
        CancellationToken cancellationToken = default);

    Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, IReadOnlyDictionary<string, string>? Errors)> DeleteCaseStudySlotAsync(
        Guid id,
        DeleteCaseStudySlotRequest request,
        CancellationToken cancellationToken = default);

    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> ReopenCompletedAsync(
        Guid id,
        ReopenCompletedWorkflowTaskRequest request,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default);

    Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default);

    Task DeleteForPropertyAsync(
        string poNumber,
        Guid propertyId,
        int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default);
}
