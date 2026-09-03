using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the case-study / party form use case. Only the Infrastructure
/// adapter opens EF. Reads are untracked unless the method says otherwise.
/// </summary>
public interface ICaseStudyFormRepository
{
    /// <summary>
    /// The case-study (<paramref name="party"/> false) or party form for the task.
    /// <paramref name="track"/> keeps it attached so edits persist on <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<CaseStudyForm?> GetFormAsync(
        Guid taskId,
        bool party,
        bool track,
        CancellationToken cancellationToken);

    Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken);

    /// <summary>Assignee ids of the task and of its children, for the read gate.</summary>
    Task<IReadOnlyList<string?>> ListTaskAndChildAssigneeIdsAsync(
        Guid taskId,
        CancellationToken cancellationToken);

    /// <summary>True when the task's case-study (non-party) form already carries the given status.</summary>
    Task<bool> CaseStudyFormHasStatusAsync(
        Guid taskId,
        string status,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Guid>> ListChildTaskIdsAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    /// <summary>Tracked party forms of the given tasks; edits persist on <see cref="SaveChangesAsync"/>.</summary>
    Task<IReadOnlyList<CaseStudyForm>> ListPartyFormsForUpdateAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    void AddForm(CaseStudyForm form);

    /// <summary>Throws <see cref="PersistenceConcurrencyException"/> when the write lost a race.</summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>Drops pending tracked state so a retry reloads from the database.</summary>
    void DiscardTrackedChanges();
}
