extern alias IdentityApi;

using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Api.IntegrationTests;

public class IdentityApiDevGateTests : IClassFixture<IdentityApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public IdentityApiDevGateTests(IdentityApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_username_returns_404_in_production()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/login-username",
            new UsernameLoginRequest { Username = "cdo" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

public sealed class IdentityApiWebApplicationFactory
    : WebApplicationFactory<IdentityApi::Program>
{
    public IdentityApiWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable(
            "REAL_ESTATE_EVAL_PG_CONNECTION_STRING_IDENTITY",
            "Host=localhost;Database=identity_integration_test");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Enabled"] = "false",
            });
        });
    }
}
