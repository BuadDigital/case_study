using Microsoft.EntityFrameworkCore;
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
    public async Task<int> AllocateNextTaskSequenceAsync(
        int year,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        if (ops.Database.IsNpgsql())
        {
            var id = Guid.NewGuid();
            var rows = await ops.Database
                .SqlQueryRaw<int>(
                    """
                    INSERT INTO case_study."OperationsTaskSequences"
                        ("Id", "Year", "NextSeq", "UpdatedAtUtc")
                    VALUES ({0}, {1}, 2, {2})
                    ON CONFLICT ("Year") DO UPDATE SET
                        "NextSeq" = case_study."OperationsTaskSequences"."NextSeq" + 1,
                        "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc"
                    RETURNING case_study."OperationsTaskSequences"."NextSeq" - 1
                    """,
                    id,
                    year,
                    nowUtc)
                .ToListAsync(cancellationToken);

            var seq = rows.FirstOrDefault();
            if (seq <= 0)
                throw new InvalidOperationException("تعذّر توليد رقم المهمة التشغيلية.");
            return seq;
        }

        var seqRow = await ops.OperationsTaskSequences
            .FirstOrDefaultAsync(s => s.Year == year, cancellationToken);

        if (seqRow is null)
        {
            seqRow = new OperationsTaskSequence
            {
                Id = Guid.NewGuid(),
                Year = year,
                NextSeq = 1,
                UpdatedAtUtc = nowUtc,
            };
            ops.OperationsTaskSequences.Add(seqRow);
        }

        var allocated = seqRow.NextSeq;
        seqRow.NextSeq += 1;
        seqRow.UpdatedAtUtc = nowUtc;
        return allocated;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        ops.SaveChangesAsync(cancellationToken);

    public Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)ops, action, cancellationToken);
}
