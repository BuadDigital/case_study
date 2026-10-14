using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

public class PostgresConnectionBudgetTests
{
    [Theory]
    [InlineData(100, 15, 26, 3)]
    [InlineData(200, 20, 26, 6)]
    [InlineData(500, 40, 26, 17)]
    [InlineData(200, 20, 13, 13)]
    public void Maximum_safe_pool_size_accounts_for_the_whole_topology(
        int serverMaxConnections,
        int reservedConnections,
        int peakPoolCount,
        int expected)
    {
        var actual = PostgresConnectionBudget.MaxSafePoolSize(
            serverMaxConnections,
            reservedConnections,
            peakPoolCount);

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Conservative_defaults_fit_postgresql_default_capacity()
    {
        Assert.True(PostgresConnectionBudget.Fits(new DatabaseOptions()));
    }

    [Fact]
    public void Oversubscribed_pool_budget_is_rejected_in_production()
    {
        using var host = CreateProductionHost(
            maxPoolSize: 20,
            serverMaxConnections: 100,
            reservedConnections: 15,
            peakPoolCount: 26);

        var ex = Assert.Throws<OptionsValidationException>(host.Start);
        Assert.Contains("connection budget", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Deployment_pool_budget_is_accepted_in_production()
    {
        using var host = CreateProductionHost(
            maxPoolSize: 6,
            serverMaxConnections: 500,
            reservedConnections: 40,
            peakPoolCount: 26);

        host.Start();
    }

    private static IHost CreateProductionHost(
        int maxPoolSize,
        int serverMaxConnections,
        int reservedConnections,
        int peakPoolCount)
    {
        var builder = Host.CreateApplicationBuilder();
        builder.Environment.EnvironmentName = Environments.Production;
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            [$"{DatabaseOptions.SectionName}:{nameof(DatabaseOptions.MaxPoolSize)}"] =
                maxPoolSize.ToString(),
            [$"{DatabaseOptions.SectionName}:{nameof(DatabaseOptions.ServerMaxConnections)}"] =
                serverMaxConnections.ToString(),
            [$"{DatabaseOptions.SectionName}:{nameof(DatabaseOptions.ReservedServerConnections)}"] =
                reservedConnections.ToString(),
            [$"{DatabaseOptions.SectionName}:{nameof(DatabaseOptions.PeakApplicationPoolCount)}"] =
                peakPoolCount.ToString(),
        });
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        return builder.Build();
    }
}
