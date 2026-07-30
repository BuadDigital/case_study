extern alias IdentityApi;

using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Abstractions;
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

    [Fact]
    public async Task Dev_login_users_returns_404_in_production()
    {
        var response = await _client.GetAsync("/api/auth/dev-login-users");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Password_login_returns_token_for_valid_credentials()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new PasswordLoginRequest
            {
                Username = "valid-user",
                Password = "valid-password",
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.Equal("integration-test-token", body?.Token);
    }

    [Fact]
    public async Task Password_login_returns_unauthorized_for_invalid_credentials()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new PasswordLoginRequest
            {
                Username = "valid-user",
                Password = "wrong-password",
            });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Password_login_rejects_missing_password()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "valid-user", password = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_returns_a_new_session_for_a_valid_refresh_token()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = StubAuthSessionService.ValidToken });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
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
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting(
            "ConnectionStrings:Identity",
            "Host=localhost;Database=identity_integration_test");
        builder.UseSetting(
            "Jwt:SigningKey",
            "integration-test-signing-key-that-is-at-least-sixty-four-characters-long-1234567890");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Enabled"] = "false",
            });
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPasswordAuthenticationService>();
            services.AddSingleton<IPasswordAuthenticationService, StubPasswordAuthenticationService>();
            services.RemoveAll<IAuthSessionService>();
            services.AddSingleton<IAuthSessionService, StubAuthSessionService>();
        });
    }
}

internal sealed class StubPasswordAuthenticationService : IPasswordAuthenticationService
{
    public Task<LoginResponse?> AuthenticateAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        if (username != "valid-user" || password != "valid-password")
            return Task.FromResult<LoginResponse?>(null);

        return Task.FromResult<LoginResponse?>(new LoginResponse
        {
            Token = "integration-test-token",
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(5),
            RefreshToken = StubAuthSessionService.ValidToken,
            RefreshTokenExpiresAtUtc = DateTime.UtcNow.AddHours(12),
            User = new UserInfoDto
            {
                Id = "integration-user",
                Email = "integration@example.test",
                DisplayName = "Integration User",
            },
        });
    }
}

internal sealed class StubAuthSessionService : IAuthSessionService
{
    public const string ValidToken = "valid-refresh-token";

    public Task<LoginResponse?> IssueForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<LoginResponse?>(null);

    public Task<LoginResponse?> IssueForUsernameAsync(
        string username,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<LoginResponse?>(null);

    public Task<LoginResponse?> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        if (refreshToken != ValidToken)
            return Task.FromResult<LoginResponse?>(null);

        return Task.FromResult<LoginResponse?>(new LoginResponse
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
