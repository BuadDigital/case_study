using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Web.Middleware;

namespace RealEstateEval.Application.Tests;

public class CommandIdempotencyStoreTests
{
    [Fact]
    public async Task Memory_store_replays_saved_response()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        ICommandIdempotencyStore store = new MemoryCommandIdempotencyStore(cache);
        var key = Key("user-1", "key-abcd-1234");
        var body = Encoding.UTF8.GetBytes("""{"ok":true}""");
        var response = new CommandIdempotencyCachedResponse(
            200,
            "application/json",
            body,
            "/api/demo/1");

        await CompleteAsync(store, key, response);
        var replay = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));

        Assert.Equal(CommandIdempotencyAcquireStatus.Replay, replay.Status);
        Assert.Equal(200, replay.Response?.StatusCode);
        Assert.Equal(body, replay.Response?.Body);
        Assert.Equal("/api/demo/1", replay.Response?.Location);
    }

    [Fact]
    public async Task Memory_store_isolates_by_actor_and_key()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        ICommandIdempotencyStore store = new MemoryCommandIdempotencyStore(cache);
        var response = new CommandIdempotencyCachedResponse(201, "application/json", [1, 2, 3]);

        await CompleteAsync(store, Key("user-a", "key-abcd-1234"), response);

        Assert.Equal(
            CommandIdempotencyAcquireStatus.Acquired,
            (await store.TryAcquireAsync(
                Key("user-b", "key-abcd-1234"),
                TimeSpan.FromMinutes(5))).Status);
        Assert.Equal(
            CommandIdempotencyAcquireStatus.Acquired,
            (await store.TryAcquireAsync(
                Key("user-a", "other-key-9999"),
                TimeSpan.FromMinutes(5))).Status);
        Assert.Equal(
            CommandIdempotencyAcquireStatus.Replay,
            (await store.TryAcquireAsync(
                Key("user-a", "key-abcd-1234"),
                TimeSpan.FromMinutes(5))).Status);
    }

    [Fact]
    public async Task Memory_store_allows_only_one_in_flight_execution()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        ICommandIdempotencyStore store = new MemoryCommandIdempotencyStore(cache);
        var key = Key("user-1", "parallel-key-1");

        var first = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));
        var second = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));

        Assert.Equal(CommandIdempotencyAcquireStatus.Acquired, first.Status);
        Assert.Equal(CommandIdempotencyAcquireStatus.InProgress, second.Status);

        await store.ReleaseAsync(key, first.ExecutionId!);
        Assert.Equal(
            CommandIdempotencyAcquireStatus.Acquired,
            (await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5))).Status);
    }

    [Fact]
    public async Task Ef_store_replays_saved_response()
    {
        await using var db = CreateDb();
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore<MessagingDbContext>(
            db,
            NullLogger<EfCommandIdempotencyStore<MessagingDbContext>>.Instance);
        var key = new CommandIdempotencyRequestKey(
            "actor-1",
            "POST",
            "/api/enfaz-billing/PO-1/collect",
            "collect-key-01");
        var body = Encoding.UTF8.GetBytes("""{"invoice":"INV-1"}""");
        var response = new CommandIdempotencyCachedResponse(
            200,
            "application/json",
            body,
            "/api/enfaz-billing/invoices/INV-1");

        await CompleteAsync(store, key, response);
        var replay = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));

        Assert.Equal(CommandIdempotencyAcquireStatus.Replay, replay.Status);
        Assert.Equal(200, replay.Response?.StatusCode);
        Assert.Equal("application/json", replay.Response?.ContentType);
        Assert.Equal(body, replay.Response?.Body);
        Assert.Equal("/api/enfaz-billing/invoices/INV-1", replay.Response?.Location);
        Assert.Single(await db.CommandIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task Ef_store_reclaims_an_expired_in_progress_reservation()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(DateTimeOffset.UtcNow);
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore<MessagingDbContext>(
            db,
            NullLogger<EfCommandIdempotencyStore<MessagingDbContext>>.Instance,
            clock);
        var key = Key("actor-1", "crashed-key-1");

        var acquired = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));
        Assert.Equal(CommandIdempotencyAcquireStatus.Acquired, acquired.Status);
        clock.Advance(TimeSpan.FromMinutes(10));

        var reclaimed = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));
        Assert.Equal(CommandIdempotencyAcquireStatus.Acquired, reclaimed.Status);
        Assert.NotEqual(acquired.ExecutionId, reclaimed.ExecutionId);
        Assert.Single(await db.CommandIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task Ef_store_ignores_expired_rows()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(DateTimeOffset.UtcNow);
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore<MessagingDbContext>(
            db,
            NullLogger<EfCommandIdempotencyStore<MessagingDbContext>>.Instance,
            clock);
        var key = Key("actor-1", "expire-key-1");

        await CompleteAsync(
            store,
            key,
            new CommandIdempotencyCachedResponse(200, null, []),
            TimeSpan.FromMinutes(5));

        clock.Advance(TimeSpan.FromMinutes(10));

        Assert.Equal(
            CommandIdempotencyAcquireStatus.Acquired,
            (await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5))).Status);
    }

    [Fact]
    public async Task Ef_store_keeps_the_winning_completed_response()
    {
        await using var db = CreateDb();
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore<MessagingDbContext>(
            db,
            NullLogger<EfCommandIdempotencyStore<MessagingDbContext>>.Instance);
        var key = Key("actor-1", "same-key-12");

        await CompleteAsync(
            store,
            key,
            new CommandIdempotencyCachedResponse(200, null, [1]),
            TimeSpan.FromHours(1));

        var replay = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));
        Assert.Equal(CommandIdempotencyAcquireStatus.Replay, replay.Status);
        Assert.Equal(200, replay.Response?.StatusCode);
        Assert.Equal(new byte[] { 1 }, replay.Response?.Body);
        Assert.Single(await db.CommandIdempotencyRecords.ToListAsync());
    }

    private static CommandIdempotencyRequestKey Key(string actor, string key) =>
        new(actor, "POST", "/api/demo", key);

    private static async Task CompleteAsync(
        ICommandIdempotencyStore store,
        CommandIdempotencyRequestKey key,
        CommandIdempotencyCachedResponse response,
        TimeSpan? ttl = null)
    {
        var acquired = await store.TryAcquireAsync(key, TimeSpan.FromMinutes(5));
        Assert.Equal(CommandIdempotencyAcquireStatus.Acquired, acquired.Status);
        Assert.True(await store.CompleteAsync(
            key,
            acquired.ExecutionId!,
            response,
            ttl ?? TimeSpan.FromHours(1)));
    }

    private static MessagingDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<MessagingDbContext>()
            .UseInMemoryDatabase($"cmd-idem-{Guid.NewGuid():N}")
            .Options;
        return new MessagingDbContext(options);
    }

    private sealed class FakeTimeProvider(DateTimeOffset start) : TimeProvider
    {
        private DateTimeOffset _utcNow = start;

        public override DateTimeOffset GetUtcNow() => _utcNow;

        public void Advance(TimeSpan delta) => _utcNow += delta;
    }
}
