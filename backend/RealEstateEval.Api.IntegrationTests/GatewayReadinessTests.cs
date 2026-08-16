extern alias GatewayApi;

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using GatewayReadinessOptions = GatewayApi::RealEstateEval.Gateway.GatewayReadinessOptions;

namespace RealEstateEval.Api.IntegrationTests;

public class GatewayReadinessOptionsTests
{
    [Fact]
    public void Defaults_probe_every_cluster()
    {
        var options = GatewayReadinessOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>()));

        Assert.True(options.Enabled);
        Assert.Equal(2, options.TimeoutSeconds);
        Assert.Equal(5, options.CacheSeconds);
        Assert.Equal("/health", options.UpstreamHealthPath);
        Assert.Empty(options.RequiredClusters);
    }

    [Fact]
    public void Configuration_overrides_defaults()
    {
        var options = GatewayReadinessOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Gateway:Readiness:TimeoutSeconds"] = "5",
                ["Gateway:Readiness:CacheSeconds"] = "0",
                ["Gateway:Readiness:UpstreamHealthPath"] = "healthz",
                ["Gateway:Readiness:RequiredClusters:0"] = "identity",
            }));

        Assert.Equal(5, options.TimeoutSeconds);
        Assert.Equal(0, options.CacheSeconds);
        Assert.Equal("/healthz", options.UpstreamHealthPath);
        Assert.Equal(new[] { "identity" }, options.RequiredClusters);
    }

    [Theory]
    [InlineData("Gateway:Readiness:TimeoutSeconds", "0")]
    [InlineData("Gateway:Readiness:TimeoutSeconds", "31")]
    [InlineData("Gateway:Readiness:CacheSeconds", "-1")]
    [InlineData("Gateway:Readiness:CacheSeconds", "301")]
    public void Unsafe_values_are_rejected(string key, string value)
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?> { [key] = value });

        Assert.Throws<InvalidOperationException>(
            () => GatewayReadinessOptions.FromConfiguration(configuration));
    }

    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}

public class GatewayReadinessEndpointTests
    : IClassFixture<GatewayWithUnreachableUpstreamFactory>
{
    private readonly HttpClient _client;

    public GatewayReadinessEndpointTests(GatewayWithUnreachableUpstreamFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Liveness_stays_up_while_upstreams_are_down()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.False(string.IsNullOrEmpty(Header(response, "Content-Security-Policy")));
    }

    [Fact]
    public async Task Readiness_reports_unreachable_upstreams()
    {
        var response = await _client.GetAsync("/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = body.RootElement;

        Assert.Equal("not_ready", root.GetProperty("status").GetString());
        Assert.Equal("gateway", root.GetProperty("service").GetString());
        Assert.Equal(
            "unreachable",
            root.GetProperty("upstreams")
                .GetProperty(GatewayWithUnreachableUpstreamFactory.ProbeClusterId)
                .GetString());
    }

    [Fact]
    public async Task Readiness_falls_back_to_liveness_when_the_probe_is_disabled()
    {
        using var factory = new GatewayWithoutReadinessProbeFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ready", body.RootElement.GetProperty("status").GetString());
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
            ? string.Join(",", values)
            : string.Empty;
}

public sealed class GatewayWithUnreachableUpstreamFactory
    : WebApplicationFactory<GatewayApi::Program>
{
    public const string ProbeClusterId = "readiness-probe-target";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");

 // Discard port: refused immediately, so readiness resolves without waiting.
        builder.UseSetting(
            $"ReverseProxy:Clusters:{ProbeClusterId}:Destinations:probe:Address",
            "http://127.0.0.1:9");
        builder.UseSetting("Gateway:Readiness:RequiredClusters:0", ProbeClusterId);
        builder.UseSetting("Gateway:Readiness:CacheSeconds", "0");
    }
}

public sealed class GatewayWithoutReadinessProbeFactory
    : WebApplicationFactory<GatewayApi::Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting("Gateway:Readiness:Enabled", "false");
    }
}
