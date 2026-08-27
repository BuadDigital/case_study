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

 /// <summary>
 /// A10: the legacy stream is archived, so a fresh database must come up from the nine
 /// bounded-context streams alone (each carries an Ensure*TablesForStandalone baseline).
 /// </summary>
    [DockerFact]
    public async Task Context_streams_provision_an_empty_database_and_leave_nothing_pending()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("migrations_smoke");

        await BoundedContextStreamMigrator.ApplyAllStreamsAsync(connectionString);

        foreach (var contextType in BoundedContextStreamMigrator.StreamTypes)
        {
            await using var stream = BoundedContextStreamMigrator.CreateStreamContext(
                contextType, connectionString);
            Assert.Empty(await stream.Database.GetPendingMigrationsAsync());
        }

 // A query per key schema proves the streams built tables, not just history rows.
        await using var caseStudy = (CaseStudyDbContext)BoundedContextStreamMigrator
            .CreateStreamContext(typeof(CaseStudyDbContext), connectionString);
        Assert.Empty(await caseStudy.WorkOrders.AsNoTracking().ToListAsync());
        Assert.Empty(await caseStudy.WorkflowTasks.AsNoTracking().ToListAsync());
        await using var identity = (IdentityDbContext)BoundedContextStreamMigrator
            .CreateStreamContext(typeof(IdentityDbContext), connectionString);
        Assert.Empty(await identity.Users.AsNoTracking().ToListAsync());
    }

 /// <summary>
 /// The deploy runbook rolls back to a named migration per stream, so the newest migration
 /// of a stream has to come off and go back on cleanly. Case Study is the busiest stream.
 /// </summary>
    [DockerFact]
    public async Task The_newest_case_study_migration_can_be_rolled_back_and_reapplied()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("migrations_rollback");
        await using var db = BoundedContextStreamMigrator.CreateStreamContext(
            typeof(CaseStudyDbContext), connectionString);

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
        services.AddDbContext<FinancialDbContext>(options =>
            UseStream<FinancialDbContext>(options, connectionString));
        services.AddDbContext<CaseStudyDbContext>(options =>
            UseStream<CaseStudyDbContext>(options, connectionString));
        services.AddDbContext<MessagingDbContext>(options =>
            UseStream<MessagingDbContext>(options, connectionString));
        services.AddIdentityApplicationServices();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());

        await using var provider = services.BuildServiceProvider();

 // The seeder writes identity and platform tables, so it needs every stream the deploy
 // migrator applies (A10: the streams alone provision the schema).
        await using (var scope = provider.CreateAsyncScope())
        {
            foreach (var context in BoundedContextStreamMigrator.StreamTypes)
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
            var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
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
            var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            Assert.Equal(seededUsers, await db.Users.CountAsync());
        }
    }

    private static void UseStream<TContext>(
        DbContextOptionsBuilder options,
        string connectionString)
        where TContext : DbContext =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            BoundedContextMigrations.HistoryTable,
            BoundedContextMigrations.HistorySchemaFor<TContext>()));
}
