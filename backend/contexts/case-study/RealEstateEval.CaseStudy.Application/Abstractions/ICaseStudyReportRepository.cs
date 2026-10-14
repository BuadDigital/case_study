using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the case-study / party form use case. Only the Infrastructure
/// adapter opens EF. Reads are untracked unless the method says otherwise.
/// </summary>
public interface ICaseStudyReportRepository
{
    /// <summary>
    /// The case-study (<paramref name="party"/> false) or party form for the task.
    /// <paramref name="track"/> keeps it attached so edits persist on <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<CaseStudyReport?> GetFormAsync(
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
    Task<bool> CaseStudyReportHasStatusAsync(
        Guid taskId,
        string status,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Guid>> ListChildTaskIdsAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    /// <summary>Tracked party forms of the given tasks; edits persist on <see cref="SaveChangesAsync"/>.</summary>
    Task<IReadOnlyList<CaseStudyReport>> ListPartyContributionsForUpdateAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    /// <summary>Untracked child (party) tasks of the case-study parent, any status.</summary>
    Task<IReadOnlyList<WorkflowTask>> ListChildTasksAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    /// <summary>
    /// True when a (non-cancelled) appraisal child of the parent already has a SUBMITTED package —
    /// reopening the report must tell that appraiser, and must not touch the package.
    /// </summary>
    Task<bool> HasSubmittedAppraisalPackageAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken);

    /// <summary>Deed kind of the work-order property, or null when the row is missing.</summary>
    Task<DeedKind?> GetPropertyDeedKindAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    /// <summary>
    /// The tracked property — reopening a report clears its Enfaz handover stamp, persisted on
    /// <see cref="SaveChangesAsync"/>. Null when the row is missing.
    /// </summary>
    Task<WorkOrderProperty?> GetPropertyForUpdateAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    void AddForm(CaseStudyReport form);

    /// <summary>Throws <see cref="PersistenceConcurrencyException"/> when the write lost a race.</summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>Drops pending tracked state so a retry reloads from the database.</summary>
    void DiscardTrackedChanges();

    /// <summary>
    /// Runs the action in one database transaction (a no-op wrapper on providers without
    /// transactions). The report row, the parent workflow task and the party-contribution lock
    /// share the context, so issuing / reopening commits or rolls back as one.
    /// </summary>
    Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken);

    /// <summary>Commits only when the action returns <c>Commit: true</c>; otherwise rolls back without throwing.</summary>
    Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken);
}
