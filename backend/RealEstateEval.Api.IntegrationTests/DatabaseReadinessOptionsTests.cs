using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Infrastructure.Web;

namespace RealEstateEval.Api.IntegrationTests;

public class DatabaseReadinessOptionsTests
{
    [Fact]
    public void Deployments_check_migrations_by_default()
    {
        var options = DatabaseReadinessOptions.FromConfiguration(
            Configuration([]),
            Environment("Production"));

        Assert.True(options.CheckMigrations);
        Assert.Equal(5, options.CacheSeconds);
    }

 /// <summary>
 /// The dev database is migrated by whichever service starts first, so a strict check would
 /// hold up `npm run dev:api` for reasons that never apply in a deployment.
 /// </summary>
    [Fact]
    public void Development_only_checks_connectivity()
    {
        var options = DatabaseReadinessOptions.FromConfiguration(
            Configuration([]),
            Environment("Development"));

        Assert.False(options.CheckMigrations);
    }

    [Fact]
    public void Configuration_overrides_the_environment_default()
    {
        var options = DatabaseReadinessOptions.FromConfiguration(
            Configuration(new Dictionary<string, string?>
            {
                ["Readiness:CheckMigrations"] = "true",
                ["Readiness:CacheSeconds"] = "30",
            }),
            Environment("Development"));

        Assert.True(options.CheckMigrations);
        Assert.Equal(30, options.CacheSeconds);
    }

    [Theory]
    [InlineData("-1")]
    [InlineData("301")]
    public void Unsafe_cache_windows_are_rejected(string value)
    {
        var configuration = Configuration(new Dictionary<string, string?>
        {
            ["Readiness:CacheSeconds"] = value,
        });

        Assert.Throws<InvalidOperationException>(
            () => DatabaseReadinessOptions.FromConfiguration(configuration, Environment("Production")));
    }

    private static IConfiguration Configuration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static IHostEnvironment Environment(string environmentName) =>
        new TestHostEnvironment { EnvironmentName = environmentName };

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider
        {
            get => new Microsoft.Extensions.FileProviders.NullFileProvider();
            set => throw new NotSupportedException();
        }
    }
}
