using Microsoft.Extensions.Caching.Memory;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Shared.Web.Middleware;

/// <summary>Process-local fallback for hosts that do not register a durable owner store.</summary>
public sealed class MemoryCommandIdempotencyStore(
    IMemoryCache cache,
    TimeProvider? time = null) : ICommandIdempotencyStore
{
    private readonly object _gate = new();
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public Task<CommandIdempotencyAcquireResult> TryAcquireAsync(
        CommandIdempotencyRequestKey key,
        TimeSpan processingLease,
        CancellationToken cancellationToken = default)
    {
        var cacheKey = CacheKey(key);
        var now = _time.GetUtcNow();
        lock (_gate)
        {
            if (cache.TryGetValue(cacheKey, out Entry? existing)
                && existing is not null
                && existing.ExpiresAtUtc > now)
            {
                return Task.FromResult(existing.Response is null
                    ? new CommandIdempotencyAcquireResult(CommandIdempotencyAcquireStatus.InProgress)
                    : new CommandIdempotencyAcquireResult(
                        CommandIdempotencyAcquireStatus.Replay,
                        Response: existing.Response));
            }

            var executionId = Guid.NewGuid().ToString("N");
            var hold = processingLease > TimeSpan.FromHours(24)
                ? processingLease
                : TimeSpan.FromHours(24);
            cache.Set(
                cacheKey,
                new Entry(executionId, null, now.Add(hold)),
                now.Add(hold));
            return Task.FromResult(new CommandIdempotencyAcquireResult(
                CommandIdempotencyAcquireStatus.Acquired,
                executionId));
        }
    }

    public Task<bool> CompleteAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        CommandIdempotencyCachedResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        var cacheKey = CacheKey(key);
        var now = _time.GetUtcNow();
        lock (_gate)
        {
            if (!cache.TryGetValue(cacheKey, out Entry? existing)
                || existing?.ExecutionId != executionId
                || existing.Response is not null)
            {
                return Task.FromResult(false);
            }

            cache.Set(
                cacheKey,
                new Entry(null, response, now.Add(ttl)),
                now.Add(ttl));
            return Task.FromResult(true);
        }
    }

    public Task ReleaseAsync(
        CommandIdempotencyRequestKey key,
        string executionId,
        CancellationToken cancellationToken = default)
    {
        var cacheKey = CacheKey(key);
        lock (_gate)
        {
            if (cache.TryGetValue(cacheKey, out Entry? existing)
                && existing?.ExecutionId == executionId
                && existing.Response is null)
            {
                cache.Remove(cacheKey);
            }
        }

        return Task.CompletedTask;
    }

    private static string CacheKey(CommandIdempotencyRequestKey key) =>
        $"cmd-idem:{key.ActorId}:{key.HttpMethod}:{key.RequestPath}:{key.IdempotencyKey}";

    private sealed record Entry(
        string? ExecutionId,
        CommandIdempotencyCachedResponse? Response,
        DateTimeOffset ExpiresAtUtc);
}
