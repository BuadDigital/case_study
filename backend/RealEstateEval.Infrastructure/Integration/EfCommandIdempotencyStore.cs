using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>Durable Idempotency-Key store backed by messaging.CommandIdempotencyRecords.</summary>
public sealed class EfCommandIdempotencyStore<TContext>(
    TContext db,
    ILogger<EfCommandIdempotencyStore<TContext>> logger,
    TimeProvider? time = null) : ICommandIdempotencyStore
    where TContext : DbContext, ICommandIdempotencyDbContext
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<CommandIdempotencyAcquireResult> TryAcquireAsync(
        CommandIdempotencyRequestKey key,
        TimeSpan processingLease,
        CancellationToken cancellationToken = default)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var existing = await FindAsync(key, cancellationToken);
        // A live row blocks (in progress) or replays (completed). Once its lease or TTL has
        // passed it is reclaimed below, so a crashed or abandoned execution never locks the
        // key for longer than the processing lease.
        if (existing is not null && existing.ExpiresAtUtc > now)
            return ResultFor(existing);

        var executionId = Guid.NewGuid().ToString("N");
        var leaseExpiresAt = now.Add(processingLease);

        if (existing is not null)
        {
            var claimed = await TryReclaimExpiredAsync(
                key,
                executionId,
                now,
                leaseExpiresAt,
                cancellationToken);
            if (claimed)
            {
                return new CommandIdempotencyAcquireResult(
                    CommandIdempotencyAcquireStatus.Acquired,
                    executionId);
            }

            return await ReadContendedResultAsync(key, cancellationToken);
        }

        db.CommandIdempotencyRecords.Add(new CommandIdempotencyRecord
        {
            ActorId = key.ActorId,
            HttpMethod = key.HttpMethod,
            RequestPath = key.RequestPath,
            IdempotencyKey = key.IdempotencyKey,
            ExecutionId = executionId,
            StatusCode = 0,
            ContentType = null,
            Location = null,
            ResponseBody = [],
            CreatedAtUtc = now,
            ExpiresAtUtc = leaseExpiresAt,
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return new CommandIdempotencyAcquireResult(
                CommandIdempotencyAcquireStatus.Acquired,
                executionId);
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
            })
        {
            db.ChangeTracker.Clear();
            logger.LogInformation(
                "Command idempotency acquisition race for {Method} {Path}; using winning reservation",
                key.HttpMethod,
                key.RequestPath);
            return await ReadContendedResultAsync(key, cancellationToken);
        }
    }

    public async Task<bool> CompleteAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        CommandIdempotencyCachedResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        var expiresAt = _time.GetUtcNow().UtcDateTime.Add(ttl);
        if (db.Database.IsRelational())
        {
            var updated = await db.CommandIdempotencyRecords
                .Where(x =>
                    x.ActorId == key.ActorId
                    && x.HttpMethod == key.HttpMethod
                    && x.RequestPath == key.RequestPath
                    && x.IdempotencyKey == key.IdempotencyKey
                    && x.StatusCode == 0
                    && x.ExecutionId == executionId)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(x => x.ExecutionId, (string?)null)
                        .SetProperty(x => x.StatusCode, response.StatusCode)
                        .SetProperty(x => x.ContentType, response.ContentType)
                        .SetProperty(x => x.Location, response.Location)
                        .SetProperty(x => x.ResponseBody, response.Body)
                        .SetProperty(x => x.ExpiresAtUtc, expiresAt),
                    cancellationToken);
            return updated == 1;
        }

        var row = await FindTrackedAsync(key, cancellationToken);
        if (row is null || row.StatusCode != 0 || row.ExecutionId != executionId)
            return false;

        row.ExecutionId = null;
        row.StatusCode = response.StatusCode;
        row.ContentType = response.ContentType;
        row.Location = response.Location;
        row.ResponseBody = response.Body;
        row.ExpiresAtUtc = expiresAt;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task ReleaseAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        CancellationToken cancellationToken = default)
    {
        if (db.Database.IsRelational())
        {
            await db.CommandIdempotencyRecords
                .Where(x =>
                    x.ActorId == key.ActorId
                    && x.HttpMethod == key.HttpMethod
                    && x.RequestPath == key.RequestPath
                    && x.IdempotencyKey == key.IdempotencyKey
                    && x.StatusCode == 0
                    && x.ExecutionId == executionId)
                .ExecuteDeleteAsync(cancellationToken);
            return;
        }

        var row = await FindTrackedAsync(key, cancellationToken);
        if (row is null || row.StatusCode != 0 || row.ExecutionId != executionId)
            return;

        db.CommandIdempotencyRecords.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
    }

    private Task<CommandIdempotencyRecord?> FindAsync(
        CommandIdempotencyRequestKey key,
        CancellationToken cancellationToken) =>
        db.CommandIdempotencyRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x =>
                    x.ActorId == key.ActorId
                    && x.HttpMethod == key.HttpMethod
                    && x.RequestPath == key.RequestPath
                    && x.IdempotencyKey == key.IdempotencyKey,
                cancellationToken);

    private Task<CommandIdempotencyRecord?> FindTrackedAsync(
        CommandIdempotencyRequestKey key,
        CancellationToken cancellationToken) =>
        db.CommandIdempotencyRecords
            .FirstOrDefaultAsync(
                x =>
                    x.ActorId == key.ActorId
                    && x.HttpMethod == key.HttpMethod
                    && x.RequestPath == key.RequestPath
                    && x.IdempotencyKey == key.IdempotencyKey,
                cancellationToken);

    private async Task<bool> TryReclaimExpiredAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        DateTime now,
        DateTime leaseExpiresAt,
        CancellationToken cancellationToken)
    {
        if (db.Database.IsRelational())
        {
            var updated = await db.CommandIdempotencyRecords
                .Where(x =>
                    x.ActorId == key.ActorId
                    && x.HttpMethod == key.HttpMethod
                    && x.RequestPath == key.RequestPath
                    && x.IdempotencyKey == key.IdempotencyKey
                    && x.ExpiresAtUtc <= now)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(x => x.ExecutionId, executionId)
                        .SetProperty(x => x.StatusCode, 0)
                        .SetProperty(x => x.ContentType, (string?)null)
                        .SetProperty(x => x.Location, (string?)null)
                        .SetProperty(x => x.ResponseBody, Array.Empty<byte>())
                        .SetProperty(x => x.CreatedAtUtc, now)
                        .SetProperty(x => x.ExpiresAtUtc, leaseExpiresAt),
                    cancellationToken);
            return updated == 1;
        }

        var row = await FindTrackedAsync(key, cancellationToken);
        if (row is null || row.ExpiresAtUtc > now)
            return false;

        row.ExecutionId = executionId;
        row.StatusCode = 0;
        row.ContentType = null;
        row.Location = null;
        row.ResponseBody = [];
        row.CreatedAtUtc = now;
        row.ExpiresAtUtc = leaseExpiresAt;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<CommandIdempotencyAcquireResult> ReadContendedResultAsync(
        CommandIdempotencyRequestKey key,
        CancellationToken cancellationToken)
    {
        var row = await FindAsync(key, cancellationToken);
        return row is null
            ? new CommandIdempotencyAcquireResult(CommandIdempotencyAcquireStatus.InProgress)
            : ResultFor(row);
    }

    private static CommandIdempotencyAcquireResult ResultFor(CommandIdempotencyRecord row) =>
        row.StatusCode == 0
            ? new CommandIdempotencyAcquireResult(CommandIdempotencyAcquireStatus.InProgress)
            : new CommandIdempotencyAcquireResult(
                CommandIdempotencyAcquireStatus.Replay,
                Response: new CommandIdempotencyCachedResponse(
                    row.StatusCode,
                    row.ContentType,
                    row.ResponseBody,
                    row.Location));
    }
