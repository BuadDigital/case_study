using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Persistence boundary for the operations-task command use cases. Every read is materialised
/// by the adapter, so <c>OperationsTaskCommands</c> in <c>Operations.Application</c> never
/// composes a query and never sees <c>OperationsDbContext</c> (solid-scorecard finding 1).
/// </summary>
/// <remarks>
/// Entities come back tracked: the use case mutates the aggregate through its domain methods
/// and then calls <see cref="SaveChangesAsync"/>, so the adapter and the use case must share
/// one scoped unit of work.
/// </remarks>
public interface IOperationsTaskRepository
{
    /// <summary>Tracked load by id; <c>null</c> when the task does not exist.</summary>
    Task<OperationsTask?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Stages a newly created task. Persisted by the next <see cref="SaveChangesAsync"/>.</summary>
    Task AddAsync(OperationsTask task, CancellationToken cancellationToken);

    /// <summary>Tracked tasks in <c>created</c> or <c>in_progress</c> — the auto-reminder sweep.</summary>
    Task<IReadOnlyList<OperationsTask>> ListActiveAsync(CancellationToken cancellationToken);

    /// <summary>Tracked tasks paused with a recorded pause timestamp — the over-limit sweep.</summary>
    Task<IReadOnlyList<OperationsTask>> ListPausedAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Race-safe yearly counter behind <c>T-{year}-{seq}</c>. On PostgreSQL this is a single
    /// upsert returning the allocated value; on providers without it the sequence row is staged
    /// and persisted by the caller's <see cref="SaveChangesAsync"/> inside the same transaction.
    /// </summary>
    Task<int> AllocateNextTaskSequenceAsync(
        int year,
        DateTime nowUtc,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Runs the unit of work in a database transaction, committing only when the action
    /// returns <c>Commit: true</c>. Falls through without a transaction on providers that
    /// have none (the in-memory test provider).
    /// </summary>
    Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken);
}
