using RealEstateEval.CaseStudy.Application.Contracts;
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

    /// <summary>
    /// Links an empty Enfath slot to its freshly created property draft without leaving the
    /// phase. (null, error) when the slot is not an empty Enfath slot or the property is not
    /// a live property of the slot's work order.
    /// </summary>
    Task<(WorkflowTaskDto? Result, string? Error)> LinkPropertyAsync(
        Guid id,
        LinkTaskPropertyRequest request,
        CancellationToken cancellationToken = default);

    Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RevertPhaseAsync(
        Guid id,
        RevertWorkflowTaskPhaseRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Kind / status / phase of a task for the generic patch guard; null when it does not exist.</summary>
    Task<WorkflowTaskPatchStateDto?> GetPatchStateAsync(
        Guid id,
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
        string? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, IReadOnlyDictionary<string, string>? Errors)> DeleteForPoAsync(
        string poNumber,
        CancellationToken cancellationToken = default);

    Task<(bool Ok, IReadOnlyDictionary<string, string>? Errors)> DeleteForPropertyAsync(
        string poNumber,
        Guid propertyId,
        int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default);
}
