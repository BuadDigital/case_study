extern alias IdentityApi;

using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Api.IntegrationTests;

public class IdentityApiDevGateTests : IClassFixture<IdentityApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public IdentityApiDevGateTests(IdentityApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public void Startup_allows_passwordless_login_when_enabled_in_production()
    {
        using var factory = IdentityApiWebApplicationFactory.CreateWithDevLoginEnabled();
        using var client = factory.CreateClient();
        Assert.NotNull(client);
    }

    [Fact]
    public async Task Login_returns_404_when_passwordless_login_disabled()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new UsernameLoginRequest { Username = "cdo" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Login_returns_token_when_passwordless_login_enabled()
    {
        using var factory = IdentityApiWebApplicationFactory.CreateWithDevLoginEnabled();
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new UsernameLoginRequest { Username = "valid-user" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.Equal("integration-test-token", body?.Token);
    }

    [Fact]
    public async Task Login_returns_unauthorized_for_unknown_user_when_enabled()
    {
        using var factory = IdentityApiWebApplicationFactory.CreateWithDevLoginEnabled();
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new UsernameLoginRequest { Username = "missing-user" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_rejects_blank_username()
    {
        using var factory = IdentityApiWebApplicationFactory.CreateWithDevLoginEnabled();
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Dev_login_users_returns_404_when_passwordless_login_disabled()
    {
        var response = await _client.GetAsync("/api/auth/dev-login-users");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_returns_a_new_session_for_a_valid_refresh_token()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = StubAuthSessionService.ValidToken });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponseDto>();
        Assert.Equal("refreshed-access-token", body?.Token);
        Assert.Equal("refreshed-refresh-token", body?.RefreshToken);
    }

    [Fact]
    public async Task Refresh_returns_unauthorized_for_an_unknown_refresh_token()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = "revoked-or-unknown" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_rejects_a_missing_refresh_token()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Updating_a_user_requires_authentication()
    {
        var response = await _client.PatchAsJsonAsync(
            "/api/users/some-user-id",
            new { city = "جدة" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unlocking_a_user_requires_authentication()
    {
        var response = await _client.PostAsync("/api/users/some-user-id/unlock", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_without_requiring_an_access_token()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/logout",
            new RefreshTokenRequest { RefreshToken = StubAuthSessionService.ValidToken });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}

public sealed class IdentityApiWebApplicationFactory
    : WebApplicationFactory<IdentityApi::Program>
{
    private readonly bool _enableDevLoginInProduction;

    public IdentityApiWebApplicationFactory()
    {
    }

    private IdentityApiWebApplicationFactory(bool enableDevLoginInProduction)
    {
        _enableDevLoginInProduction = enableDevLoginInProduction;
    }

    public static IdentityApiWebApplicationFactory CreateWithDevLoginEnabled() =>
        new(enableDevLoginInProduction: true);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => builder.UseSetting(key, value),
            "Host=localhost;Database=identity_integration_test");
        builder.UseSetting(
            "Jwt:SigningKey",
            "integration-test-signing-key-that-is-at-least-sixty-four-characters-long-1234567890");
        builder.UseSetting(
            "Auth:EnableDevLogin",
            _enableDevLoginInProduction ? "true" : "false");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Enabled"] = "false",
                ["Auth:EnableDevLogin"] = _enableDevLoginInProduction ? "true" : "false",
            });
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IAuthSessionService>();
            services.AddSingleton<IAuthSessionService, StubAuthSessionService>();
        });
    }
}

internal sealed class StubAuthSessionService : IAuthSessionService
{
    public const string ValidToken = "valid-refresh-token";

    public Task<LoginResponseDto?> IssueForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<LoginResponseDto?>(null);

    public Task<LoginResponseDto?> IssueForUsernameAsync(
        string username,
        CancellationToken cancellationToken = default)
    {
        if (username != "valid-user")
            return Task.FromResult<LoginResponseDto?>(null);

        return Task.FromResult<LoginResponseDto?>(new LoginResponseDto
        {
            Token = "integration-test-token",
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(5),
            RefreshToken = ValidToken,
            RefreshTokenExpiresAtUtc = DateTime.UtcNow.AddHours(12),
            User = new UserInfoDto
            {
                Id = "integration-user",
                Email = "integration@example.test",
                DisplayName = "Integration User",
            },
        });
    }

    public Task<LoginResponseDto?> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        if (refreshToken != ValidToken)
            return Task.FromResult<LoginResponseDto?>(null);

        return Task.FromResult<LoginResponseDto?>(new LoginResponseDto
        {
            Token = "refreshed-access-token",
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(15),
            RefreshToken = "refreshed-refresh-token",
            RefreshTokenExpiresAtUtc = DateTime.UtcNow.AddHours(12),
            User = new UserInfoDto
            {
                Id = "integration-user",
                Email = "integration@example.test",
                DisplayName = "Integration User",
            },
        });
    }

    public Task RevokeAsync(
        string refreshToken,
        string reason,
        CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<int> RevokeAllForUserAsync(
        string userId,
        string reason,
        CancellationToken cancellationToken = default) => Task.FromResult(0);
}
