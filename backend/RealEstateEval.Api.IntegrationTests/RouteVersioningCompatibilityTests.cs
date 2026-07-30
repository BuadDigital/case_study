extern alias ReportingApi;

using System.Net;

using ReportingMarker =
    ReportingApi::RealEstateEval.Reporting.Api.Controllers.ReportingController;

namespace RealEstateEval.Api.IntegrationTests;

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
}

internal sealed class ReportingRouteFactory : ServiceApiFactory<ReportingMarker>
{
    protected override string ServiceName => "Reporting";
}
