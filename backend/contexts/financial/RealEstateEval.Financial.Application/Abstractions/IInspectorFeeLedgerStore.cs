using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Persistence boundary for the inspector-fee use case. The service in
/// <c>Financial.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// </summary>
/// <remarks>
/// Ledgers come back <b>tracked</b>: accrual, patch, and transition all mutate the returned
/// entity and then call <see cref="SaveChangesAsync"/>. The transition applier shares the same
/// unit of work, so a single save commits the ledger and its audit transition together.
/// </remarks>
public interface IInspectorFeeLedgerStore
{
    /// <summary>Tracked ledgers of one workflow task, in no particular order.</summary>
    Task<IReadOnlyList<InspectorFeeLedger>> ListByWorkflowTaskAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tracked ledgers of one workflow task, most recently touched first
    /// (updated, then created), so the transition picker sees the live line first.
    /// </summary>
    Task<IReadOnlyList<InspectorFeeLedger>> ListByWorkflowTaskNewestFirstAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken);

    /// <summary>First tracked ledger of the task, or null when none was ever opened.</summary>
    Task<InspectorFeeLedger?> FindByWorkflowTaskAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Tracked ledger for one (transaction, deed, user) line — the accrual identity. Used to
    /// pick up a line opened against a different workflow task before a second fee is created.
    /// </summary>
    Task<InspectorFeeLedger?> FindByIdentityAsync(
        Guid transactionId,
        Guid deedId,
        string userId,
        CancellationToken cancellationToken);

    void AddLedger(InspectorFeeLedger ledger);

    void AddTransition(InspectorFeeTransition transition);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>Removes the transitions and then the ledgers of the given tasks.</summary>
    Task DeleteForWorkflowTasksAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        CancellationToken cancellationToken);
}
