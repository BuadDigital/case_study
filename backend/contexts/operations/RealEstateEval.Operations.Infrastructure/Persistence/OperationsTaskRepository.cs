using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;

namespace RealEstateEval.Operations.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IOperationsTaskRepository"/>. The only place the operations-task
/// command use case reaches <see cref="OperationsDbContext"/>.
/// </summary>
public sealed class OperationsTaskRepository(OperationsDbContext ops) : IOperationsTaskRepository
{
    public Task<OperationsTask?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        ops.OperationsTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public Task AddAsync(OperationsTask task, CancellationToken cancellationToken)
    {
        ops.OperationsTasks.Add(task);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<OperationsTask>> ListActiveAsync(
        CancellationToken cancellationToken) =>
        await ops.OperationsTasks
            .Where(t => t.Status == OperationsTaskStatus.Created
                || t.Status == OperationsTaskStatus.InProgress)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<OperationsTask>> ListPausedAsync(
        CancellationToken cancellationToken) =>
        await ops.OperationsTasks
            .Where(t => t.Status == OperationsTaskStatus.Paused && t.PausedAtUtc != null)
            .ToListAsync(cancellationToken);

    /// <summary>
    /// Race-safe yearly counter. Mirrors the DocumentReferenceCounter upsert used by billing
    /// statements: on PostgreSQL a single INSERT ... ON CONFLICT returns the allocated value,
    /// elsewhere the row is staged and the caller's SaveChanges persists it.
    /// </summary>
 /// <summary>Sequence prefix under which task display ids are counted in the operations reference table.</summary>
    public const string TaskSequencePrefix = "T";

    public async Task<int> AllocateNextTaskSequenceAsync(
        int year,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var (sequence, error) = await ReferenceSequenceAllocator.AllocateYearlySequenceAsync(
            ops.Database,
            ops.Set<ReferenceSequence>(),
            saveChangesAsync: null,
            DatabaseSchemas.Operations,
            TaskSequencePrefix,
            year,
            nowUtc,
            cancellationToken);
        if (error is not null)
            throw new InvalidOperationException("تعذّر توليد رقم المهمة التشغيلية.");
        return sequence;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        ops.SaveChangesAsync(cancellationToken);

    public Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)ops, action, cancellationToken);
}
