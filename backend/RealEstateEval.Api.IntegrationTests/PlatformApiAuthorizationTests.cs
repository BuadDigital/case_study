extern alias PlatformApi;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Platform holds the configuration every other service reads — field dictionary and the
/// case-study info-role matrix. Reads are open to any signed-in user; writes are limited to the
/// system-config capability, and no other administrative capability substitutes for it.
/// </summary>
public class PlatformApiAuthorizationTests : IClassFixture<PlatformApiFactory>
{
    private static readonly string UserAdminToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.ManageUsers);
    private static readonly string WorkOrderToken =
        TestAuthHandler.TokenFor(PlatformCapabilities.ManageWorkOrders);

    private readonly HttpClient _client;

    public PlatformApiAuthorizationTests(PlatformApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/api/field-dictionary")]
    [InlineData("/api/case-study-info-roles")]
    [InlineData("/api/regions/selectable")]
    [InlineData("/api/regions/cities/selectable")]
    public async Task Configuration_reads_require_authentication(string path)
    {
        var response = await _client.GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/field-dictionary")]
    [InlineData("/api/case-study-info-roles")]
    public async Task Configuration_writes_require_authentication(string path)
    {
        var response = await _client.PutAsJsonAsync(path, new { });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/field-dictionary")]
    [InlineData("/api/case-study-info-roles")]
    public async Task Configuration_writes_reject_a_signed_in_user(string path)
    {
        var response = await PutAsync(path, TestAuthHandler.AuthOnlyToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/field-dictionary")]
    [InlineData("/api/case-study-info-roles")]
    public async Task Other_administrative_capabilities_do_not_unlock_configuration(string path)
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(path, UserAdminToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(path, WorkOrderToken)).StatusCode);
    }

    private async Task<HttpResponseMessage> PutAsync(string path, string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, path)
        {
            Content = JsonContent.Create(new { }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }
}

public sealed class PlatformApiFactory : ServiceApiFactory<PlatformApi::Program>
{
    protected override string ServiceName => "Platform";
}
