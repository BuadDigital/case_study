using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;

namespace RealEstateEval.Api.ContainerTests;

[Collection(PostgresCollection.Name)]
public sealed class CommandIdempotencyPostgresTests(PostgresFixture postgres)
{
    [DockerFact]
    public async Task Parallel_instances_execute_one_command_and_replay_its_response()
    {
        var connectionString = await postgres.CreateDatabaseAsync("command_idempotency");
        await using (var migrationContext = CreateDb(connectionString))
            await migrationContext.Database.MigrateAsync();

        var key = new CommandIdempotencyRequestKey(
            "actor-1",
            "POST",
            "/api/commands",
            "parallel-key-0001");

        await using var db1 = CreateDb(connectionString);
        await using var db2 = CreateDb(connectionString);
        var store1 = Store(db1);
        var store2 = Store(db2);

        var results = await Task.WhenAll(
            store1.TryAcquireAsync(key, TimeSpan.FromMinutes(5)),
            store2.TryAcquireAsync(key, TimeSpan.FromMinutes(5)));

        var winner = Assert.Single(
            results,
            result => result.Status == CommandIdempotencyAcquireStatus.Acquired);
        Assert.Single(
            results,
            result => result.Status == CommandIdempotencyAcquireStatus.InProgress);

        var winningStore = results[0].Status == CommandIdempotencyAcquireStatus.Acquired
            ? store1
            : store2;
        Assert.True(await winningStore.CompleteAsync(
            key,
            winner.ExecutionId!,
            new CommandIdempotencyCachedResponse(
                201,
                "application/json",
                [1, 2, 3],
                "/api/commands/command-1"),
            TimeSpan.FromHours(24)));

        await using var restartedDb = CreateDb(connectionString);
        var replay = await Store(restartedDb).TryAcquireAsync(key, TimeSpan.FromMinutes(5));
        Assert.Equal(CommandIdempotencyAcquireStatus.Replay, replay.Status);
        Assert.Equal(201, replay.Response?.StatusCode);
        Assert.Equal(new byte[] { 1, 2, 3 }, replay.Response?.Body);
        Assert.Equal("/api/commands/command-1", replay.Response?.Location);
    }

    private static MessagingDbContext CreateDb(string connectionString)
    {
        var options = new DbContextOptionsBuilder<MessagingDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new MessagingDbContext(options);
    }

    private static EfCommandIdempotencyStore<MessagingDbContext> Store(
        MessagingDbContext db) =>
        new(
            db,
            NullLogger<EfCommandIdempotencyStore<MessagingDbContext>>.Instance);
}
