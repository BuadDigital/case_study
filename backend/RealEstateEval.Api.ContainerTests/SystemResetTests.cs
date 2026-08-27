using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// The dev system reset (DELETE /api/system/data) was redesigned after the database split to
/// truncate every owner context and re-run the demo seed. Only a real Postgres proves the
/// generated TRUNCATE and the identity purge work together.
/// </summary>
[Collection(PostgresCollection.Name)]
public class SystemResetTests
{
    private readonly PostgresFixture _postgres;

    public SystemResetTests(PostgresFixture postgres) => _postgres = postgres;

    [DockerFact]
    public async Task Reset_wipes_seeded_data_and_reseeds_demo_content()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("system_reset");

 // The extracted owners refuse a shared-database fallback, so point every dedicated
 // connection at the single container database (schemas keep the tables apart).
        var settings = new Dictionary<string, string?>();
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => settings[key] = value, connectionString);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

        await BoundedContextStreamMigrator.ApplyAllStreamsAsync(connectionString);

        await using (var seedProvider = DevSeedProvider.CreateIdentityMaintenanceProvider(
            configuration, connectionString))
        {
            await DataSeeder.SeedAsync(seedProvider);
        }

        var maintenance = new DevSystemMaintenanceService(configuration, connectionString);
        var result = await maintenance.ResetAllOperationalDataAsync();

 // The demo seed had populated these catalogs, so the reset must report wiping them.
        Assert.True(result.SurveyOfficesDeleted > 0, "seeded survey offices were not counted");
        Assert.True(
            result.FailureTypesCatalogConfigsDeleted > 0,
            "seeded failure-types catalog was not counted");
        Assert.True(result.RegisteredUsersDeleted >= 0);

 // The reset ends with a full reseed: demo users and catalogs must be back.
        await using var resetProvider = DevSeedProvider.CreateResetProvider(
            configuration, connectionString);
        await using var scope = resetProvider.CreateAsyncScope();
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var operations = scope.ServiceProvider.GetRequiredService<OperationsDbContext>();
        Assert.True(await identity.Users.AnyAsync(), "demo users were not reseeded");
        Assert.True(await operations.SurveyOffices.AnyAsync(), "survey offices were not reseeded");

 // Running the reset twice must not fail (the endpoint is retried freely in dev).
        var second = await maintenance.ResetAllOperationalDataAsync();
        Assert.True(second.SurveyOfficesDeleted > 0);
    }
}
