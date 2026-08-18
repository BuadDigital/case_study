using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
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

            var environment = new TestHostEnvironment(Environments.Production);

            Assert.Throws<InvalidOperationException>(
                () => ServiceCollectionExtensions.RequireConnectionString(
                    configuration,
                    serviceName: ServiceDatabaseNames.Identity,
                    environment: environment));
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

            var environment = new TestHostEnvironment(Environments.Production);
            var value = ServiceCollectionExtensions.RequireConnectionString(
                configuration,
                serviceName: ServiceDatabaseNames.Identity,
                environment: environment);

            Assert.Equal("Host=prod;Database=identity", value);
        });
    }

    [Fact]
    public void RequireConnectionString_rejects_default_connection_in_development()
    {
        WithClearedIdentityEnv(() =>
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = "Host=dev;Database=shared",
                })
                .Build();

            var environment = new TestHostEnvironment(Environments.Development);

            Assert.Throws<InvalidOperationException>(
                () => ServiceCollectionExtensions.RequireConnectionString(
                    configuration,
                    serviceName: ServiceDatabaseNames.Identity,
                    environment: environment));
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

    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = nameof(ConnectionStringConfigurationValidationTests);
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
