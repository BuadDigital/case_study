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
        // Soft checks report only; on by default so /ready shows broker and cache state.
        Assert.True(options.CheckRabbit);
        Assert.True(options.CheckRedis);
    }

    [Fact]
    public void Soft_probes_are_time_boxed_below_the_gateway_upstream_timeout()
    {
        var options = DatabaseReadinessOptions.FromConfiguration(
            Configuration([]),
            Environment("Production"));

        // Gateway:Readiness:TimeoutSeconds defaults to 2 s; both soft probes run in parallel.
        Assert.Equal(750, options.SoftProbeTimeoutMilliseconds);
        Assert.True(options.SoftProbeTimeoutMilliseconds < 2_000);
    }

    [Theory]
    [InlineData("10")]
    [InlineData("20000")]
    public void Soft_probe_timeout_is_validated(string value)
    {
        Assert.Throws<InvalidOperationException>(() =>
            DatabaseReadinessOptions.FromConfiguration(
                Configuration(new Dictionary<string, string?>
                {
                    ["Readiness:SoftProbeTimeoutMilliseconds"] = value,
                }),
                Environment("Production")));
    }

    [Fact]
    public void Soft_checks_can_be_switched_off()
    {
        var options = DatabaseReadinessOptions.FromConfiguration(
            Configuration(new Dictionary<string, string?>
            {
                ["Readiness:CheckRabbit"] = "false",
                ["Readiness:CheckRedis"] = "false",
            }),
            Environment("Production"));

        Assert.False(options.CheckRabbit);
        Assert.False(options.CheckRedis);
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
                ["Readiness:CheckRabbit"] = "true",
                ["Readiness:CheckRedis"] = "true",
            }),
            Environment("Development"));

        Assert.True(options.CheckMigrations);
        Assert.Equal(30, options.CacheSeconds);
        Assert.True(options.CheckRabbit);
        Assert.True(options.CheckRedis);
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

    [Theory]
    [InlineData("localhost:6379", "localhost", 6379)]
    [InlineData("redis:6379,abortConnect=false", "redis", 6379)]
    [InlineData("localhost", "localhost", 6379)]
    [InlineData("[::1]:6380", "::1", 6380)]
    public void Redis_connection_strings_yield_a_tcp_endpoint(string input, string host, int port)
    {
        Assert.True(RedisTcpEndpoint.TryParse(input, out var parsedHost, out var parsedPort));
        Assert.Equal(host, parsedHost);
        Assert.Equal(port, parsedPort);
    }

    [Theory]
    [InlineData("")]
    [InlineData("localhost:abc")]
    [InlineData("[]:6379")]
    public void Invalid_redis_connection_strings_are_rejected(string input)
    {
        Assert.False(RedisTcpEndpoint.TryParse(input, out _, out _));
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
