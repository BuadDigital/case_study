extern alias FailuresApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Failures are raised by external parties but adjudicated by case staff. The two capabilities are
/// deliberately different, and <c>RaiseFailures</c> accepts either one — so the risk is a party
/// token quietly gaining approval rights.
/// </summary>
public class FailuresApiAuthorizationTests : IClassFixture<FailuresApiFactory>
{
    private static readonly string PartyToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.SubmitPartyWork);

    private readonly HttpClient _client;
    private readonly Guid _failureId = Guid.NewGuid();

    public FailuresApiAuthorizationTests(FailuresApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Anonymous_reads_are_rejected()
    {
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/failures")).StatusCode);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await _client.GetAsync("/api/failures/property?poNumber=1&propertyId=2")).StatusCode);
    }

    [Fact]
    public async Task Anonymous_writes_are_rejected()
    {
        var response = await _client.PostAsJsonAsync("/api/failures", new { poNumber = "PO-1" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Raising_a_failure_needs_a_raise_or_manage_capability()
    {
        var response = await PostAsync("/api/failures", TestAuthHandler.AuthOnlyToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/failures/{id}/upgrade")]
    [InlineData("/api/failures/{id}/submit")]
    [InlineData("/api/failures/{id}/suspend")]
    [InlineData("/api/failures/{id}/resolve")]
    [InlineData("/api/failures/{id}/approve")]
    [InlineData("/api/failures/{id}/return")]
    [InlineData("/api/failures/bourse-obstruction")]
    public async Task Parties_may_raise_failures_but_never_adjudicate_them(string template)
    {
        var response = await PostAsync(Path(template), PartyToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Parties_cannot_delete_a_purchase_orders_failures()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Delete,
            "/api/failures/by-po/PO-1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", PartyToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private string Path(string template) => template.Replace("{id}", _failureId.ToString());

    private async Task<HttpResponseMessage> PostAsync(string path, string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(new { note = "n", poNumber = "PO-1" }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }
}

public sealed class FailuresApiFactory : ServiceApiFactory<FailuresApi::Program>
{
    protected override string ServiceName => "Failures";
}
