using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;
using System.Text.Json;

namespace RealEstateEval.Infrastructure.Caching;

public sealed class RedisCacheOptions
{
    public bool Enabled { get; set; } = true;
    public string ConnectionString { get; set; } = "localhost:6379";
    public string InstanceName { get; set; } = "ree:";
}

public sealed class ApiResponseCache
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

 /// <summary>
 /// In-flight rebuilds, so a cold or expired key costs one query per process instead of
 /// one per concurrent request. Keyed by cache key and result type because the same key
 /// must never hand back a task producing a different shape.
 /// </summary>
    private readonly ConcurrentDictionary<(string Key, Type Type), Lazy<Task<object?>>> _inFlight =
        new();

    private readonly IDistributedCache _cache;
    private readonly RedisCacheOptions _options;
    private readonly ILogger<ApiResponseCache> _logger;

    public ApiResponseCache(
        IDistributedCache cache,
        IOptions<RedisCacheOptions> options,
        ILogger<ApiResponseCache> logger)
    {
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => _options.Enabled;

    public async Task<T> GetOrCreateAsync<T>(
        string key,
        TimeSpan ttl,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
            return await factory(cancellationToken);

        var fullKey = _options.InstanceName + key;
        try
        {
            var cached = await _cache.GetStringAsync(fullKey, cancellationToken);
            if (cached is not null)
            {
                var hit = JsonSerializer.Deserialize<T>(cached, JsonOpts);
                if (hit is not null)
                    return hit;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis read failed for {Key}; loading from source", fullKey);
        }

        return await LoadOnceAsync(fullKey, ttl, factory, cancellationToken);
    }

 /// <summary>
 /// Collapses concurrent misses on one key into a single rebuild. Callers that arrive
 /// while a rebuild is running wait for it; the alternative is every request that hits an
 /// expired key running the same expensive aggregate against PostgreSQL at once.
 /// </summary>
    private async Task<T> LoadOnceAsync<T>(
        string fullKey,
        TimeSpan ttl,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        var slot = (fullKey, typeof(T));
        var mine = new Lazy<Task<object?>>(
            () => RebuildAsync(fullKey, ttl, factory, cancellationToken),
            LazyThreadSafetyMode.ExecutionAndPublication);
        var inFlight = _inFlight.GetOrAdd(slot, mine);

        if (!ReferenceEquals(inFlight, mine))
        {
            try
            {
                return (T)(await inFlight.Value.WaitAsync(cancellationToken))!;
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
 // The request that owned the rebuild was aborted or failed; its scoped
 // DbContext is gone, so load on our own instead of failing with it.
                _logger.LogWarning(
                    ex,
                    "Shared rebuild for {Key} did not complete; loading from source",
                    fullKey);
                return await factory(cancellationToken);
            }
        }

        try
        {
            return (T)(await inFlight.Value)!;
        }
        finally
        {
            _inFlight.TryRemove(slot, out _);
        }
    }

    private async Task<object?> RebuildAsync<T>(
        string fullKey,
        TimeSpan ttl,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        var value = await factory(cancellationToken);

        try
        {
            await _cache.SetStringAsync(
                fullKey,
                JsonSerializer.Serialize(value, JsonOpts),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = ttl,
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis write failed for {Key}", fullKey);
        }

        return value;
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
            return;

        try
        {
            await _cache.RemoveAsync(_options.InstanceName + key, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis remove failed for {Key}", key);
        }
    }
}
