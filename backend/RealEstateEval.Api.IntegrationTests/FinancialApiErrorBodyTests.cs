using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// A handled failure must tell the caller what to do next without repeating the
/// exception text, which routinely carries table names and other internal detail.
/// </summary>
public class FinancialApiErrorBodyTests : IClassFixture<FinancialApiWebApplicationFactory>
{
    private static readonly string SystemConfigToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.ManageSystemConfig);

    private readonly HttpClient _client;

    public FinancialApiErrorBodyTests(FinancialApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Delete_failure_returns_problem_details_without_the_exception_message()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/financial/v1/party-fee-pricing/{StubPartyFeePricingService.ThrowingDeleteId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", SystemConfigToken);

        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        Assert.DoesNotContain(
            StubPartyFeePricingService.InternalFailureMessage,
            body,
            StringComparison.Ordinal);
        Assert.DoesNotContain("fee_pricing_tables", body, StringComparison.Ordinal);
        Assert.DoesNotContain("InvalidOperationException", body, StringComparison.Ordinal);

        using var document = JsonDocument.Parse(body);
        Assert.Equal(400, document.RootElement.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(
            document.RootElement.GetProperty("detail").GetString()));
    }

    [Fact]
    public async Task Delete_succeeds_for_a_table_that_can_be_removed()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/financial/v1/party-fee-pricing/{Guid.NewGuid()}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", SystemConfigToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_pricing_category_filter_returns_400()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/financial/v1/party-fee-pricing/tables?category=engineering_survey");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", SystemConfigToken);

        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("تصنيف", body, StringComparison.Ordinal);
    }
}
