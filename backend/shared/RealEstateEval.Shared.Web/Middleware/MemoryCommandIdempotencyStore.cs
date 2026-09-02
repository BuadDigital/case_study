using Microsoft.Extensions.Caching.Memory;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Shared.Web.Middleware;

/// <summary>Process-local fallback when messaging DB is not registered (e.g. identity-only hosts).</summary>
public sealed class MemoryCommandIdempotencyStore(IMemoryCache cache) : ICommandIdempotencyStore
{
    public Task<CommandIdempotencyCachedResponse?> TryGetAsync(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey,
        CancellationToken cancellationToken = default)
    {
        var key = CacheKey(actorId, httpMethod, requestPath, idempotencyKey);
        cache.TryGetValue(key, out CommandIdempotencyCachedResponse? cached);
        return Task.FromResult(cached);
    }

    public Task SaveAsync(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey,
        CommandIdempotencyCachedResponse response,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        var key = CacheKey(actorId, httpMethod, requestPath, idempotencyKey);
        cache.Set(key, response, ttl);
        return Task.CompletedTask;
    }

    private static string CacheKey(
        string actorId,
        string httpMethod,
        string requestPath,
        string idempotencyKey) =>
        $"cmd-idem:{actorId}:{httpMethod}:{requestPath}:{idempotencyKey}";
}
