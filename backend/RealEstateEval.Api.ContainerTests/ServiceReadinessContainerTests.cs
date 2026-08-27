extern alias FinancialApi;

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// <c>/ready</c> gates traffic in Compose and in the deploy smoke check, so its verdict is
/// asserted against a real database: unmigrated is not ready, migrated is.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ServiceReadinessContainerTests
{
    private readonly PostgresFixture _postgres;

    public ServiceReadinessContainerTests(PostgresFixture postgres) => _postgres = postgres;

    [DockerFact]
    public async Task Readiness_reports_not_ready_until_migrations_are_applied()
    {
        var connectionString = await _postgres.CreateDatabaseAsync("readiness_smoke");

        using var factory = new ReadinessCheckedFinancialApiFactory(connectionString);
        using var client = factory.CreateClient();

        var beforeMigrating = await client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, beforeMigrating.StatusCode);
        Assert.Equal("migrations_pending", await ReadDatabaseStatusAsync(beforeMigrating));

        // /ready checks the host's own migration stream (A10: streams alone provision).
        await BoundedContextStreamMigrator.ApplyAllStreamsAsync(connectionString);

        var afterMigrating = await client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.OK, afterMigrating.StatusCode);
        Assert.Equal("ready", await ReadDatabaseStatusAsync(afterMigrating));
    }

    [DockerFact]
    public async Task Readiness_reports_an_unreachable_database_without_taking_liveness_down()
    {
        using var factory = new ReadinessCheckedFinancialApiFactory(
            "Host=127.0.0.1;Port=1;Database=nowhere;Username=none;Password=none;Timeout=1");
        using var client = factory.CreateClient();

        var ready = await client.GetAsync("/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, ready.StatusCode);
        Assert.Equal("unreachable", await ReadDatabaseStatusAsync(ready));

        var health = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
    }

    private static async Task<string?> ReadDatabaseStatusAsync(HttpResponseMessage response)
    {
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("database").GetString();
    }
}

public sealed class ReadinessCheckedFinancialApiFactory
    : WebApplicationFactory<FinancialApi::Program>
{
    private readonly string _connectionString;

    public ReadinessCheckedFinancialApiFactory(string connectionString) =>
        _connectionString = connectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => builder.UseSetting(key, value),
            _connectionString);
        builder.UseSetting("Redis:Enabled", "false");

 // Development defaults the migration check off; these tests are about the strict mode
 // that non-Development deployments run, and caching would hide the second verdict.
        builder.UseSetting("Readiness:CheckMigrations", "true");
        builder.UseSetting("Readiness:CacheSeconds", "0");
    }
}
