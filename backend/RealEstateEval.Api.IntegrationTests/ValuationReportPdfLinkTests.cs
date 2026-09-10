extern alias ValuationApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class ValuationApiWebApplicationFactory : ServiceApiFactory<ValuationApi::Program>
{
    protected override string ServiceName => "Valuation";
}

/// <summary>
/// Report PDF links: the public <c>/api/valuation-reports/{file}.pdf?k=…</c> route must answer
/// 404 for anything but a validly signed key, and the render endpoint stays behind the
/// submit-valuation-report capability — read-valuation-report is the GET side only.
/// None of these reach the database.
/// </summary>
public class ValuationReportPdfLinkTests : IClassFixture<ValuationApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ValuationReportPdfLinkTests(ValuationApiWebApplicationFactory factory) =>
        _client = factory.CreateClient();

    [Fact]
    public async Task Public_link_without_key_returns_404()
    {
        var response = await _client.GetAsync("/api/valuation-reports/051421.pdf");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Public_link_with_forged_key_returns_404()
    {
        var forged = $"{Guid.NewGuid():N}.{DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeSeconds()}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        var response = await _client.GetAsync($"/api/valuation-reports/051421.pdf?k={forged}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("report.txt")]
    [InlineData("..%2Freport.pdf")]
    [InlineData("%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.pdf")]
    public async Task Public_link_with_unsafe_file_name_returns_404(string fileName)
    {
        var response = await _client.GetAsync($"/api/valuation-reports/{fileName}?k=abc.1.def");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Public_link_does_not_require_a_session()
    {
        // Anonymous callers get the same 404 as a bad key — never a 401 challenge.
        var response = await _client.GetAsync("/api/valuation-reports/051421.pdf?k=abc.1.def");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Null(response.Headers.WwwAuthenticate.FirstOrDefault());
    }

    [Fact]
    public async Task Render_without_token_returns_401()
    {
        var response = await _client.PostAsJsonAsync(
            $"/api/valuation-requests/{Guid.NewGuid()}/report-pdf",
            new { html = "<html><body>x</body></html>" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Render_without_capability_returns_403()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/valuation-requests/{Guid.NewGuid()}/report-pdf")
        {
            Content = JsonContent.Create(new { html = "<html><body>x</body></html>" }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestAuthHandler.AuthOnlyToken);

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Render_with_case_staff_capability_returns_403()
    {
        // manage-work-orders reads the report of a transaction it runs (GET), but must never
        // publish a report body under the appraiser's report number.
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/valuation-requests/{Guid.NewGuid()}/report-pdf")
        {
            Content = JsonContent.Create(new { html = "<html><body>x</body></html>" }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestAuthHandler.TokenFor(PlatformCapabilities.ManageWorkOrders));

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Render_with_capability_rejects_empty_html_before_touching_storage()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/valuation-requests/{Guid.NewGuid()}/report-pdf")
        {
            Content = JsonContent.Create(new { html = "" }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestAuthHandler.TokenFor(PlatformCapabilities.SubmitValuationReport));

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Latest_link_without_token_returns_401()
    {
        var response = await _client.GetAsync($"/api/valuation-requests/{Guid.NewGuid()}/report-pdf");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
