using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>Durable Idempotency-Key store backed by messaging.CommandIdempotencyRecords.</summary>
public sealed class EfCommandIdempotencyStore(
    MessagingDbContext db,
    ILogger<EfCommandIdempotencyStore> logger,
    TimeProvider? time = null) : ICommandIdempotencyStore
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<CommandIdempotencyCachedResponse?> TryGetAsync(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var row = await db.CommandIdempotencyRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x =>
                    x.ActorId == actorId
                    && x.HttpMethod == httpMethod
                    && x.RequestPath == requestPath
                    && x.IdempotencyKey == idempotencyKey
                    && x.ExpiresAtUtc > now,
                cancellationToken);

        if (row is null) return null;

        return new CommandIdempotencyCachedResponse(
            row.StatusCode,
            row.ContentType,
            row.ResponseBody);
    }

    public async Task SaveAsync(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey,
        CommandIdempotencyCachedResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var existing = await db.CommandIdempotencyRecords
            .FirstOrDefaultAsync(
                x =>
                    x.ActorId == actorId
                    && x.HttpMethod == httpMethod
                    && x.RequestPath == requestPath
                    && x.IdempotencyKey == idempotencyKey,
                cancellationToken);

        if (existing is not null)
        {
            existing.StatusCode = response.StatusCode;
            existing.ContentType = response.ContentType;
            existing.ResponseBody = response.Body;
            existing.ExpiresAtUtc = now.Add(ttl);
        }
        else
        {
            db.CommandIdempotencyRecords.Add(new CommandIdempotencyRecord
            {
                ActorId = actorId,
                HttpMethod = httpMethod,
                RequestPath = requestPath,
                IdempotencyKey = idempotencyKey,
                StatusCode = response.StatusCode,
                ContentType = response.ContentType,
                ResponseBody = response.Body,
                CreatedAtUtc = now,
                ExpiresAtUtc = now.Add(ttl),
            });
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Concurrent first insert — winner already stored; treat as success.
            db.ChangeTracker.Clear();
            logger.LogInformation(
                "Command idempotency race for {Method} {Path}; keeping winning row",
                httpMethod,
                requestPath);
        }
    }
}
