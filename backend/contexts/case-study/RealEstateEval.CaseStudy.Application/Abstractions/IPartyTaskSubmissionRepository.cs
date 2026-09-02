using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Read-model facts about a workflow task that party-submission authorization and sibling
/// checks need. Kept narrower than <see cref="WorkflowTask"/> so the adapter can project.
/// </summary>
public sealed record PartyTaskFacts(
    Guid Id,
    string? AssigneeId,
    WorkflowTaskKind Kind,
    WorkflowTaskStatus Status,
    Guid? PropertyId,
    Guid? ParentTaskId);

/// <summary>
/// Persistence boundary for the party-task-submission use case. The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// Reads are untracked unless the method says otherwise.
/// </summary>
public interface IPartyTaskSubmissionRepository
{
    /// <summary>Untracked task snapshot, or null when the task does not exist.</summary>
    Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken);

    Task<IReadOnlyList<PartyTaskFacts>> ListTaskFactsAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Untracked tasks whose parent is in <paramref name="parentTaskIds"/> and whose property
    /// is in <paramref name="propertyIds"/>. Callers filter by kind / status / assignee.
    /// </summary>
    Task<IReadOnlyList<WorkflowTask>> ListSiblingTasksAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    Task<PartyTaskSubmission?> GetSubmissionAsync(
        Guid taskId,
        bool track,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PartyTaskSubmission>> ListSubmissionsAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    /// <summary>Task ids among <paramref name="taskIds"/> whose submission carries an acceptance stamp.</summary>
    Task<IReadOnlySet<Guid>> ListAcceptedSubmissionTaskIdsAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken);

    /// <summary>Untracked property with its contacts and work order, for documentary gates.</summary>
    Task<WorkOrderProperty?> GetPropertyWithContactsAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    void Add(PartyTaskSubmission submission);

    /// <summary>
    /// Stages the projected field-inspection workspace row: inserts when absent, otherwise
    /// overwrites every column except the original creation stamp. Saved with the unit of work.
    /// </summary>
    Task UpsertFieldInspectionWorkspaceAsync(
        FieldInspectionWorkspace projected,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken);

    /// <summary>Commits only when the action returns <c>Commit: true</c>; otherwise rolls back without throwing.</summary>
    Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken);
}
