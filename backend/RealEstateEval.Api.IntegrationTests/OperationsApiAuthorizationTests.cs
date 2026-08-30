extern alias OperationsApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Key custody is the operations service's sensitive surface: reads are open to operations and
/// finance staff, while every mutation needs a narrower capability. These assert the gap between
/// the two, since a policy typo would otherwise only show up in production.
/// </summary>
public class OperationsApiAuthorizationTests : IClassFixture<OperationsApiFactory>
{
    private static readonly string ReadKeyDataToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.ManageFinancial);
    private static readonly string OperationsToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.ManageOperations);
    private static readonly string PartyToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.SubmitPartyWork);

    private static readonly string FeeCollectedPath =
        $"/api/key-envelopes/{Guid.NewGuid()}/fee-collected";

    private readonly HttpClient _client;

    public OperationsApiAuthorizationTests(OperationsApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/api/property-keys")]
    [InlineData("/api/key-envelopes")]
    [InlineData("/api/key-envelopes/fee-report")]
    [InlineData("/api/survey-offices")]
    [InlineData("/api/operations-tasks")]
    public async Task Anonymous_requests_are_rejected(string path)
    {
        var response = await _client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/property-keys")]
    [InlineData("/api/key-envelopes")]
    [InlineData("/api/key-envelopes/fee-report")]
    public async Task Key_data_is_hidden_from_users_without_the_capability(string path)
    {
        var response = await GetAsync(path, TestAuthHandler.AuthOnlyToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

 /// <summary>
 /// A request that clears authorization is answered by the handler's own validation, so a 400
 /// here (rather than 403) is the evidence that finance staff pass the key-data policy.
 /// </summary>
    [Fact]
    public async Task Finance_staff_pass_the_key_data_policy()
    {
        var allowed = await GetAsync("/api/key-envelopes/linked-properties", ReadKeyDataToken);
        Assert.Equal(HttpStatusCode.BadRequest, allowed.StatusCode);

        var denied = await GetAsync(
            "/api/key-envelopes/linked-properties",
            TestAuthHandler.AuthOnlyToken);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Fact]
    public async Task Reading_key_data_does_not_grant_editing_it()
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Patch,
            $"/api/property-keys/{Guid.NewGuid()}")
        {
            Content = JsonContent.Create(new { hasKey = true }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ReadKeyDataToken);

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

 /// <summary>
 /// Envelope writes sit behind both policies on the controller and the action, so key readers
 /// and party submitters are each rejected on their own.
 /// </summary>
    [Theory]
    [InlineData(nameof(OperationsToken))]
    [InlineData(nameof(PartyToken))]
    public async Task Creating_an_envelope_needs_key_reads_and_party_work_together(string actor)
    {
        var token = actor == nameof(OperationsToken) ? OperationsToken : PartyToken;

        var response = await PostAsync("/api/key-envelopes", token);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

 /// <summary>
 /// Confirming key-receipt collection is a finance act. It used to sit behind
 /// <c>submit-party-work</c>, which finance staff do not hold, so the button labelled "Finance"
 /// could only be pressed by the parties it was meant to keep out.
 /// </summary>
    [Theory]
    [InlineData(nameof(PartyToken))]
    [InlineData(nameof(OperationsToken))]
    public async Task Confirming_fee_collection_is_denied_to_everyone_but_finance(string actor)
    {
        var token = actor == nameof(PartyToken) ? PartyToken : OperationsToken;

        var response = await PostAsync(FeeCollectedPath, token);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

 /// <summary>
 /// This pipeline never reaches storage, so finance clearing the gate can only be shown by the
 /// absence of a rejection — the handler fails later, on the database it cannot open.
 /// </summary>
    [Fact]
    public async Task Finance_staff_clear_the_fee_collection_gate()
    {
        var response = await PostAsync(FeeCollectedPath, ReadKeyDataToken);

        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_tokens_are_not_authenticated()
    {
        var response = await GetAsync("/api/survey-offices", "not-a-test-token");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<HttpResponseMessage> GetAsync(string path, string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> PostAsync(string path, string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(new { requestNumber = "REQ-1" }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }
}

public sealed class OperationsApiFactory : ServiceApiFactory<OperationsApi::Program>
{
    protected override string ServiceName => "Operations";
}
