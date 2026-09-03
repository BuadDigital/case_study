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
        var body = Encoding.UTF8.GetBytes("""{"ok":true}""");
        var response = new CommandIdempotencyCachedResponse(200, "application/json", body);

        await store.SaveAsync("user-1", "POST", "/api/demo", "key-abcd-1234", response, TimeSpan.FromHours(1));
        var replay = await store.TryGetAsync("user-1", "POST", "/api/demo", "key-abcd-1234");

        Assert.NotNull(replay);
        Assert.Equal(200, replay.StatusCode);
        Assert.Equal(body, replay.Body);
    }

    [Fact]
    public async Task Memory_store_isolates_by_actor_and_key()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        ICommandIdempotencyStore store = new MemoryCommandIdempotencyStore(cache);
        var response = new CommandIdempotencyCachedResponse(201, "application/json", [1, 2, 3]);

        await store.SaveAsync("user-a", "POST", "/api/demo", "key-abcd-1234", response, TimeSpan.FromHours(1));

        Assert.Null(await store.TryGetAsync("user-b", "POST", "/api/demo", "key-abcd-1234"));
        Assert.Null(await store.TryGetAsync("user-a", "POST", "/api/demo", "other-key-9999"));
        Assert.NotNull(await store.TryGetAsync("user-a", "POST", "/api/demo", "key-abcd-1234"));
    }

    [Fact]
    public async Task Ef_store_replays_saved_response()
    {
        await using var db = CreateDb();
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore(
            db,
            NullLogger<EfCommandIdempotencyStore>.Instance);
        var body = Encoding.UTF8.GetBytes("""{"invoice":"INV-1"}""");
        var response = new CommandIdempotencyCachedResponse(200, "application/json", body);

        await store.SaveAsync(
            "actor-1",
            "POST",
            "/api/enfaz-billing/PO-1/collect",
            "collect-key-01",
            response,
            TimeSpan.FromHours(24));

        var replay = await store.TryGetAsync(
            "actor-1",
            "POST",
            "/api/enfaz-billing/PO-1/collect",
            "collect-key-01");

        Assert.NotNull(replay);
        Assert.Equal(200, replay.StatusCode);
        Assert.Equal("application/json", replay.ContentType);
        Assert.Equal(body, replay.Body);
        Assert.Single(await db.CommandIdempotencyRecords.ToListAsync());
    }

    [Fact]
    public async Task Ef_store_ignores_expired_rows()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(DateTimeOffset.UtcNow);
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore(
            db,
            NullLogger<EfCommandIdempotencyStore>.Instance,
            clock);

        await store.SaveAsync(
            "actor-1",
            "POST",
            "/api/demo",
            "expire-key-1",
            new CommandIdempotencyCachedResponse(200, null, []),
            TimeSpan.FromMinutes(5));

        clock.Advance(TimeSpan.FromMinutes(10));

        Assert.Null(await store.TryGetAsync("actor-1", "POST", "/api/demo", "expire-key-1"));
    }

    [Fact]
    public async Task Ef_store_upsert_keeps_latest_body()
    {
        await using var db = CreateDb();
        ICommandIdempotencyStore store = new EfCommandIdempotencyStore(
            db,
            NullLogger<EfCommandIdempotencyStore>.Instance);

        await store.SaveAsync(
            "actor-1",
            "POST",
            "/api/demo",
            "same-key-12",
            new CommandIdempotencyCachedResponse(200, null, [1]),
            TimeSpan.FromHours(1));
        await store.SaveAsync(
            "actor-1",
            "POST",
            "/api/demo",
            "same-key-12",
            new CommandIdempotencyCachedResponse(409, "application/json", [9]),
            TimeSpan.FromHours(1));

        var replay = await store.TryGetAsync("actor-1", "POST", "/api/demo", "same-key-12");
        Assert.NotNull(replay);
        Assert.Equal(409, replay.StatusCode);
        Assert.Equal(new byte[] { 9 }, replay.Body);
        Assert.Single(await db.CommandIdempotencyRecords.ToListAsync());
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
