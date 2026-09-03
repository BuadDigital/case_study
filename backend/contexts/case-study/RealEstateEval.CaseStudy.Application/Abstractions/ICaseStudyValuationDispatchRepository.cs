using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the case-study to valuation dispatch use case. The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// Reads are untracked unless the method says otherwise.
/// </summary>
public interface ICaseStudyValuationDispatchRepository
{
    Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken);

    Task<bool> HasAppraisalChildAsync(Guid parentTaskId, CancellationToken cancellationToken);

    /// <summary>Newest property-appraisal child of the parent task, or null when there is none.</summary>
    Task<WorkflowTask?> GetLatestAppraisalChildAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    Task<WorkOrderProperty?> GetPropertyAsync(Guid propertyId, CancellationToken cancellationToken);

    /// <summary>Tracked submission for the task; edits are persisted by <see cref="SaveChangesAsync"/>.</summary>
    Task<PartyTaskSubmission?> GetSubmissionAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken);

    void AddSubmission(PartyTaskSubmission submission);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
