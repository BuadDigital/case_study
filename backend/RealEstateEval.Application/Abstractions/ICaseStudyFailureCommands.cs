using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Case Study side effects the Failures workflow applies (deed status, task obstruction,
/// access holds, property timeline). The Case Study host uses EF; the Failures host calls
/// HTTP. Do not open Case Study EF on the Failures host (A9).
/// </summary>
public interface ICaseStudyFailureCommands
{
    /// <summary>Sets DeedStatus on the property the failure identifies (Guid or deed number). No-op when unmatched.</summary>
    Task SetFailureDeedStatusAsync(
        SetCaseStudyDeedStatusRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Moves the open case-study task into obstruction (supervisor shell patch). No-op when no task.</summary>
    Task EscalateObstructionAsync(
        EscalateCaseStudyObstructionRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resumes the open case-study task from obstruction; when the resume phase is bourse,
    /// also resets the property's bourse completion. No-op when no resumable task.
    /// </summary>
    Task ResolveObstructionAsync(
        ResolveCaseStudyObstructionRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Blocks every non-completed task of the property (approved failure). No-op when unmatched.</summary>
    Task BlockPropertyTasksForFailureAsync(
        BlockCaseStudyTasksForFailureRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Blocks the open case-study task for an access hold. Null when no eligible task.</summary>
    Task<CaseStudyHoldTaskResultDto?> BlockTaskForHoldAsync(
        CaseStudyHoldTaskRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Unblocks the case-study task previously blocked for a hold. Null when none.</summary>
    Task<CaseStudyHoldTaskResultDto?> UnblockTaskForHoldAsync(
        CaseStudyHoldTaskRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Records an idempotent property-timeline event (keyed on PO + property + event key).</summary>
    Task RecordPropertyTimelineEventAsync(
        PropertyTimelineRecordRequest request,
        CancellationToken cancellationToken = default);
}
