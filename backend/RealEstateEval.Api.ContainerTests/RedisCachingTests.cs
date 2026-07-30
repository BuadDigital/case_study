using System.Text;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Infrastructure;
using Testcontainers.Redis;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// <c>AddRedisCaching</c> silently falls back to an in-process cache when Redis is disabled, so a
/// broken connection string would look like a working cache in every other test. This checks the
/// enabled path against a real server.
/// </summary>
public class RedisCachingTests : IAsyncLifetime
{
    private RedisContainer? _container;

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable)
            return;

        _container = new RedisBuilder("redis:7-alpine").Build();
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
            await _container.DisposeAsync();
    }

    [DockerFact]
    public async Task Configured_redis_serves_the_distributed_cache()
    {
        var cache = BuildCache(new Dictionary<string, string?>
        {
            ["Redis:Enabled"] = "true",
            ["Redis:ConnectionString"] = Endpoint(),
            ["Redis:InstanceName"] = "container-tests:",
        });

        await cache.SetAsync(
            "smoke-key",
            Encoding.UTF8.GetBytes("cached"),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1),
            });

        Assert.Equal("cached", Encoding.UTF8.GetString(await cache.GetAsync("smoke-key") ?? []));

        await cache.RemoveAsync("smoke-key");
        Assert.Null(await cache.GetAsync("smoke-key"));
    }

    [DockerFact]
    public async Task A_disabled_cache_stays_in_process()
    {
        var cache = BuildCache(new Dictionary<string, string?> { ["Redis:Enabled"] = "false" });

        await cache.SetAsync("smoke-key", Encoding.UTF8.GetBytes("local"));

        Assert.Equal("local", Encoding.UTF8.GetString(await cache.GetAsync("smoke-key") ?? []));
    }

    private string Endpoint()
    {
        var container = _container ?? throw new InvalidOperationException("Redis is not running.");
        return $"{container.Hostname}:{container.GetMappedPublicPort(6379)}";
    }

    private static IDistributedCache BuildCache(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddRedisCaching(configuration);

        return services.BuildServiceProvider().GetRequiredService<IDistributedCache>();
    }
}
