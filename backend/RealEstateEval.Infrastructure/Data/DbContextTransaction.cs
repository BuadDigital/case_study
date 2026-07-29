using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Runs a unit of work inside a database transaction when the provider supports it.
/// In-memory tests fall through without a transaction so the same service code stays
/// usable under both PostgreSQL and EF's InMemory provider.
/// </summary>
public static class DbContextTransaction
{
    /// <summary>
    /// Commits when <paramref name="action"/> completes without throwing.
    /// </summary>
    public static Task ExecuteInTransactionAsync(
        ApplicationDbContext db,
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken = default) =>
        ExecuteInTransactionAsync(
            db,
            async ct =>
            {
                await action(ct);
                return (Commit: true, Result: true);
            },
            cancellationToken);

    /// <summary>
    /// Runs <paramref name="action"/> and commits only when it returns
    /// <c>Commit: true</c>. Returning <c>Commit: false</c> rolls back without throwing —
    /// useful for business-rule failures that already produced an error payload.
    /// </summary>
    public static async Task<T> ExecuteInTransactionAsync<T>(
        ApplicationDbContext db,
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsRelational())
        {
            var (_, result) = await action(cancellationToken);
            return result;
        }

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var (commit, result) = await action(cancellationToken);
                if (commit)
                    await tx.CommitAsync(cancellationToken);
                else
                    await tx.RollbackAsync(cancellationToken);
                return result;
            }
            catch
            {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        });
    }
}
