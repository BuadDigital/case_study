extern alias FailuresApi;
extern alias OperationsApi;
extern alias PlatformApi;
extern alias ReportingApi;

using System.Net;

using FailuresMarker = FailuresApi::Program;
using OperationsMarker = OperationsApi::Program;
using PlatformMarker = PlatformApi::Program;
using ReportingMarker =
    ReportingApi::RealEstateEval.Reporting.Api.Controllers.ReportingController;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// C10: canonical unversioned routes and `/v1` aliases must both reach the pipeline
/// (401 without auth still proves the route mapped).
/// </summary>
public sealed class RouteVersioningCompatibilityTests
{
    [Theory]
    [InlineData("/api/financial/summary")]
    [InlineData("/api/financial/v1/summary")]
    public async Task Financial_canonical_and_v1_alias_routes_resolve(string path)
    {
        using var factory = new FinancialApiWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/reporting/dashboard")]
    [InlineData("/api/reporting/v1/dashboard")]
    public async Task Reporting_canonical_and_v1_alias_routes_resolve(string path)
    {
        using var factory = new ReportingRouteFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/failures")]
    [InlineData("/api/failures/v1")]
    public async Task Failures_canonical_and_v1_alias_routes_resolve(string path)
    {
        using var factory = new FailuresRouteFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/key-envelopes")]
    [InlineData("/api/key-envelopes/v1")]
    public async Task Key_envelopes_canonical_and_v1_alias_routes_resolve(string path)
    {
        using var factory = new OperationsRouteFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/notifications")]
    [InlineData("/api/notifications/v1")]
    public async Task Notifications_canonical_and_v1_alias_routes_resolve(string path)
    {
        using var factory = new PlatformRouteFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}

internal sealed class ReportingRouteFactory : ServiceApiFactory<ReportingMarker>
{
    protected override string ServiceName => "Reporting";
}

internal sealed class FailuresRouteFactory : ServiceApiFactory<FailuresMarker>
{
    protected override string ServiceName => "Failures";
}

internal sealed class OperationsRouteFactory : ServiceApiFactory<OperationsMarker>
{
    protected override string ServiceName => "Operations";
}

internal sealed class PlatformRouteFactory : ServiceApiFactory<PlatformMarker>
{
    protected override string ServiceName => "Platform";
}
