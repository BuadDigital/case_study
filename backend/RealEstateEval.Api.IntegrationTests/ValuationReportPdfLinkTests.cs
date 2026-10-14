extern alias ValuationApi;

using System.Net;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class ValuationApiWebApplicationFactory : ServiceApiFactory<ValuationApi::Program>
{
    protected override string ServiceName => "Valuation";
}

/// <summary>
/// Report PDF links: the public <c>/api/valuation-reports/{file}.pdf?k=…</c> route must answer
/// 404 for anything but a validly signed key. None of these reach the database.
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
}
