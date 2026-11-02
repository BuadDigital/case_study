using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>The inspector's «نسخ من معاملة سابقة»: earlier inspections of the same deed, photos excluded.</summary>
public interface IPriorInspectionCopyService
{
    /// <summary>Earlier submitted inspections of the task's deed, newest first; empty when the actor may not copy.</summary>
    Task<IReadOnlyList<PriorInspectionOptionDto>> ListAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>The copyable answers of one listed inspection, recorded on the timeline; null when it may not be copied.</summary>
    Task<PriorInspectionCopyDto?> CopyAsync(
        Guid taskId,
        Guid sourceTaskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default);
}
