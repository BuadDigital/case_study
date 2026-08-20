using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Runs a unit of work inside a database transaction when the provider supports it.
/// In-memory tests fall through without a transaction so the same service code stays
/// usable under both PostgreSQL and EF's InMemory provider.
/// </summary>
public static class DbContextTransaction
{
    public static Task ExecuteInTransactionAsync(
        DbContext db,
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken = default) =>
        ExecuteInTransactionAsync(db.Database, action, cancellationToken);

    public static Task<T> ExecuteInTransactionAsync<T>(
        DbContext db,
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken = default) =>
        ExecuteInTransactionAsync(db.Database, action, cancellationToken);

    public static Task ExecuteInTransactionAsync(
        ICaseStudyRepository db,
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken = default) =>
        ExecuteInTransactionAsync(db.Database, action, cancellationToken);

    public static Task<T> ExecuteInTransactionAsync<T>(
        ICaseStudyRepository db,
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken = default) =>
        ExecuteInTransactionAsync(db.Database, action, cancellationToken);

    public static Task ExecuteInTransactionAsync(
        DatabaseFacade database,
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken = default) =>
        ExecuteInTransactionAsync(
            database,
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
        DatabaseFacade database,
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken = default)
    {
        if (!database.IsRelational())
        {
            var (_, result) = await action(cancellationToken);
            return result;
        }

        var strategy = database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await database.BeginTransactionAsync(cancellationToken);
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
