using Microsoft.Extensions.Configuration;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Api.IntegrationTests;

public class ConnectionStringConfigurationValidationTests
{
    private static readonly object EnvGate = new();

    [Fact]
    public void RequireConnectionString_rejects_default_connection()
    {
        WithClearedIdentityEnv(() =>
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = "Host=prod;Database=shared",
                })
                .Build();

            Assert.Throws<InvalidOperationException>(
                () => ServiceCollectionExtensions.RequireConnectionString(
                    configuration,
                    serviceName: ServiceDatabaseNames.Identity));
        });
    }

    [Fact]
    public void RequireConnectionString_requires_the_service_scoped_connection()
    {
        WithClearedIdentityEnv(() =>
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Identity"] = "Host=prod;Database=identity",
                })
                .Build();

            var value = ServiceCollectionExtensions.RequireConnectionString(
                configuration,
                serviceName: ServiceDatabaseNames.Identity);

            Assert.Equal("Host=prod;Database=identity", value);
        });
    }

    private static void WithClearedIdentityEnv(Action body)
    {
        var name = "REAL_ESTATE_EVAL_PG_CONNECTION_STRING_IDENTITY";
        lock (EnvGate)
        {
            var previous = Environment.GetEnvironmentVariable(name);
            try
            {
                Environment.SetEnvironmentVariable(name, null);
                body();
            }
            finally
            {
                Environment.SetEnvironmentVariable(name, previous);
            }
        }
    }
}
