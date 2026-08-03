using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// Migrations are applied by a deploy-time job, so nothing else proves they still run against a
/// real Postgres. In-memory provider tests cannot: they never execute the SQL.
/// </summary>
[Collection(PostgresCollection.Name)]
public class DatabaseMigrationTests
{
    private readonly PostgresFixture _postgres;

    public DatabaseMigrationTests(PostgresFixture postgres) => _postgres = postgres;

    [DockerFact]
    public async Task Migrations_apply_to_an_empty_database_and_leave_nothing_pending()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("migrations_smoke");
        await using var db = CreateContext(connectionString);

        Assert.NotEmpty(await db.Database.GetPendingMigrationsAsync());

        await db.Database.MigrateAsync();

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.True(await db.Database.CanConnectAsync());

        // A query per schema proves the migration built tables, not just the history table.
        Assert.Empty(await db.WorkOrders.AsNoTracking().ToListAsync());
        Assert.Empty(await db.WorkflowTasks.AsNoTracking().ToListAsync());
        Assert.Empty(await db.Users.AsNoTracking().ToListAsync());
    }

    /// <summary>
    /// The deploy runbook rolls back to a named migration, so the newest migration has to come
    /// off and go back on cleanly. (Rolling all the way back to <c>0</c> currently fails on data
    /// inserted by earlier migrations — see the rollback note in <c>backend/README.md</c>.)
    /// </summary>
    [DockerFact]
    public async Task The_newest_migration_can_be_rolled_back_and_reapplied()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("migrations_rollback");
        await using var db = CreateContext(connectionString);

        await db.Database.MigrateAsync();

        var all = db.Database.GetMigrations().ToList();
        var newest = all[^1];
        var previous = all[^2];

        await db.GetService<IMigrator>().MigrateAsync(previous);
        Assert.Equal([newest], await db.Database.GetPendingMigrationsAsync());

        await db.Database.MigrateAsync();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }

    [DockerFact]
    public async Task Demo_seed_runs_against_a_migrated_database_and_is_idempotent()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("seed_smoke");

        var services = new ServiceCollection();
        services.AddLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));
        services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));
        services.AddDbContext<AttachmentsDbContext>(options =>
            UseStream<AttachmentsDbContext>(options, connectionString));
        services.AddDbContext<PlatformDbContext>(options =>
            UseStream<PlatformDbContext>(options, connectionString));
        services.AddDbContext<ValuationDbContext>(options =>
            UseStream<ValuationDbContext>(options, connectionString));
        services.AddDbContext<IdentityDbContext>(options =>
            UseStream<IdentityDbContext>(options, connectionString));
        services.AddDbContext<FailuresDbContext>(options =>
            UseStream<FailuresDbContext>(options, connectionString));
        services.AddDbContext<OperationsDbContext>(options =>
            UseStream<OperationsDbContext>(options, connectionString));
        services.AddIdentityApplicationServices();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());

        await using var provider = services.BuildServiceProvider();

        // The seeder writes identity and platform tables, so it needs every stream the deploy
        // migrator applies — the legacy one alone stops at the bounded-context cutover.
        await using (var scope = provider.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()
                .Database.MigrateAsync();
            foreach (var context in BoundedContextMigrations.ApplyOrder)
            {
                await ((DbContext)scope.ServiceProvider.GetRequiredService(context))
                    .Database.MigrateAsync();
            }
        }

        await using (var scope = provider.CreateAsyncScope())
        {
            await DataSeeder.SeedAsync(scope.ServiceProvider);
        }

        int seededUsers;
        await using (var scope = provider.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            seededUsers = await db.Users.CountAsync();
            Assert.True(seededUsers > 0, "the demo seed created no users");
        }

        // Startup re-runs the seeder on every boot; a second pass must not duplicate rows.
        await using (var scope = provider.CreateAsyncScope())
        {
            await DataSeeder.SeedAsync(scope.ServiceProvider);
        }

        await using (var scope = provider.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(seededUsers, await db.Users.CountAsync());
        }
    }

    private static ApplicationDbContext CreateContext(string connectionString) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options);

    private static void UseStream<TContext>(
        DbContextOptionsBuilder options,
        string connectionString)
        where TContext : DbContext =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            BoundedContextMigrations.HistoryTable,
            BoundedContextMigrations.HistorySchemaFor<TContext>()));
}
