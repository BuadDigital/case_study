using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Persistence port of the appraiser's reassignment requests and peer transfers.</summary>
public interface IAppraiserHandoverRepository
{
    Task<AppraiserHandoverRequest?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The open (pending or taken) request of an appraisal task, tracked; null when none.</summary>
    Task<AppraiserHandoverRequest?> FindOpenForTaskAsync(Guid appraisalTaskId, CancellationToken cancellationToken);

    /// <summary>Every open request, tracked — the sweep's input and the staff list's source.</summary>
    Task<IReadOnlyList<AppraiserHandoverRequest>> ListOpenAsync(CancellationToken cancellationToken);

    /// <summary>The open requests the appraiser raised or that wait for his acceptance, untracked.</summary>
    Task<IReadOnlyList<AppraiserHandoverRequest>> ListOpenForAppraiserAsync(
        string assigneeId,
        CancellationToken cancellationToken);

    /// <summary>The appraisal task, untracked.</summary>
    Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken);

    /// <summary>The task's party package, untracked (status and who accepted it).</summary>
    Task<PartyTaskSubmission?> GetSubmissionAsync(Guid taskId, CancellationToken cancellationToken);

    /// <summary>The deed's transaction (who handed it to review / approved it), untracked.</summary>
    Task<Transaction?> GetTransactionForPropertyAsync(Guid propertyId, CancellationToken cancellationToken);

    Task AddAsync(AppraiserHandoverRequest request, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
