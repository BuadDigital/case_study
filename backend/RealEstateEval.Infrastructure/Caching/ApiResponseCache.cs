using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
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
