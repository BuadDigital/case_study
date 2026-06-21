using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Api.IntegrationTests;

public class FinancialApiAuthorizationTests : IClassFixture<FinancialApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public FinancialApiAuthorizationTests(FinancialApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Put_summary_without_token_returns_401()
    {
        var response = await _client.PutAsJsonAsync(
            "/api/financial/v1/summary",
            SampleSummary());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Put_summary_without_capability_returns_403()
    {
        using var request = BuildPut(SampleSummary());
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestAuthHandler.AuthOnlyToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Put_summary_with_manage_financial_returns_200()
    {
        using var request = BuildPut(SampleSummary());
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestAuthHandler.FinancialToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<FinancialSummaryDto>();
        Assert.NotNull(body);
        Assert.Equal("يناير", body.PeriodLabel);
    }

    [Fact]
    public async Task Get_summary_without_token_returns_401()
    {
        var response = await _client.GetAsync("/api/financial/v1/summary");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static HttpRequestMessage BuildPut(FinancialSummaryDto body)
    {
        return new HttpRequestMessage(HttpMethod.Put, "/api/financial/v1/summary")
        {
            Content = JsonContent.Create(body),
        };
    }

    private static FinancialSummaryDto SampleSummary() => new()
    {
        PeriodLabel = "يناير",
        RevenueTotal = "100",
        ExternalCostsTotal = "20",
        ProfitMarginTotal = "80",
        ProfitMarginPercentLabel = "80%",
        PendingPayablesTotal = "10",
        RevenueGrandTotal = "100 ر",
        RevenueRows = [],
        CostRows = [],
    };
}
