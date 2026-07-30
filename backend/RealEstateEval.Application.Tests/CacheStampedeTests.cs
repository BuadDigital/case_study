using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure.Caching;

namespace RealEstateEval.Application.Tests;

public class CacheStampedeTests
{
    [Fact]
    public async Task Concurrent_misses_rebuild_the_key_once()
    {
        var cache = CreateCache(new RecordingDistributedCache());
        var release = new TaskCompletionSource();
        var builds = 0;

        async Task<IReadOnlyList<string>> Factory(CancellationToken ct)
        {
            Interlocked.Increment(ref builds);
            await release.Task;
            return ["value"];
        }

        var callers = Enumerable.Range(0, 8)
            .Select(_ => cache.GetOrCreateAsync("financial:summary", Ttl, Factory))
            .ToList();
        release.SetResult();
        var results = await Task.WhenAll(callers);

        Assert.Equal(1, builds);
        Assert.All(results, result => Assert.Equal(["value"], result));
    }

    [Fact]
    public async Task Rebuilt_value_is_written_back_so_later_callers_hit_the_cache()
    {
        var store = new RecordingDistributedCache();
        var cache = CreateCache(store);
        var builds = 0;

        Task<IReadOnlyList<string>> Factory(CancellationToken ct)
        {
            Interlocked.Increment(ref builds);
            return Task.FromResult<IReadOnlyList<string>>(["value"]);
        }

        await cache.GetOrCreateAsync("financial:summary", Ttl, Factory);
        var second = await cache.GetOrCreateAsync("financial:summary", Ttl, Factory);

        Assert.Equal(1, builds);
        Assert.Equal(["value"], second);
        Assert.Equal(1, store.Writes);
    }

    [Fact]
    public async Task Different_keys_are_not_serialised_behind_each_other()
    {
        var cache = CreateCache(new RecordingDistributedCache());
        var releaseFirst = new TaskCompletionSource();

        var blocked = cache.GetOrCreateAsync<IReadOnlyList<string>>(
            "platform:regions",
            Ttl,
            async _ =>
            {
                await releaseFirst.Task;
                return ["regions"];
            });
        var other = await cache.GetOrCreateAsync<IReadOnlyList<string>>(
            "platform:cities",
            Ttl,
            _ => Task.FromResult<IReadOnlyList<string>>(["cities"]));

        Assert.Equal(["cities"], other);
        releaseFirst.SetResult();
        Assert.Equal(["regions"], await blocked);
    }

    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(1);

    private static ApiResponseCache CreateCache(IDistributedCache store) =>
        new(
            store,
            Options.Create(new RedisCacheOptions { Enabled = true, InstanceName = "test:" }),
            NullLogger<ApiResponseCache>.Instance);

    private sealed class RecordingDistributedCache : IDistributedCache
    {
        private readonly ConcurrentDictionary<string, byte[]> _entries = new();

        public int Writes { get; private set; }

        public byte[]? Get(string key) => _entries.GetValueOrDefault(key);

        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) =>
            Task.FromResult(Get(key));

        public void Refresh(string key) { }

        public Task RefreshAsync(string key, CancellationToken token = default) =>
            Task.CompletedTask;

        public void Remove(string key) => _entries.TryRemove(key, out _);

        public Task RemoveAsync(string key, CancellationToken token = default)
        {
            Remove(key);
            return Task.CompletedTask;
        }

        public void Set(string key, byte[] value, DistributedCacheEntryOptions options)
        {
            _entries[key] = value;
            Writes++;
        }

        public Task SetAsync(
            string key,
            byte[] value,
            DistributedCacheEntryOptions options,
            CancellationToken token = default)
        {
            Set(key, value, options);
            return Task.CompletedTask;
        }
    }
}
