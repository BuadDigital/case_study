extern alias IdentityApi;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Exercises the shared pipeline hardening on a real service host: security headers, the
/// authentication rate limiter and the configuration-driven CORS policy.
/// </summary>
public class HttpSecurityPipelineTests : IClassFixture<HardenedIdentityApiWebApplicationFactory>
{
    private const string AllowedOrigin = HardenedIdentityApiWebApplicationFactory.AllowedOrigin;

    private readonly HttpClient _client;

    public HttpSecurityPipelineTests(HardenedIdentityApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Api_responses_carry_security_headers()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("no-referrer", Header(response, "Referrer-Policy"));
        Assert.Equal(
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            Header(response, "Content-Security-Policy"));
        Assert.False(string.IsNullOrEmpty(Header(response, "Permissions-Policy")));
    }

    [Fact]
    public async Task Security_headers_survive_error_responses()
    {
 // /api/auth/me challenges without a token; GlobalExceptionHandlerMiddleware-style
 // rewrites must not drop the headers.
        var response = await _client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.False(string.IsNullOrEmpty(Header(response, "Content-Security-Policy")));
    }

    [Fact]
    public async Task Hsts_is_emitted_only_for_https_traffic()
    {
        var plain = await _client.GetAsync("/health");
        Assert.Equal(string.Empty, Header(plain, "Strict-Transport-Security"));

        using var forwarded = new HttpRequestMessage(HttpMethod.Get, "/health");
        forwarded.Headers.Add("X-Forwarded-Proto", "https");
        var behindTls = await _client.SendAsync(forwarded);

        Assert.Equal(
            "max-age=31536000; includeSubDomains",
            Header(behindTls, "Strict-Transport-Security"));
    }

    [Fact]
    public async Task Login_is_throttled_with_problem_details()
    {
        const string clientIp = "203.0.113.10";

        var first = await PostLoginAsync(clientIp);
        var second = await PostLoginAsync(clientIp);
        var third = await PostLoginAsync(clientIp);

        Assert.Equal(HttpStatusCode.Unauthorized, first.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, second.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, third.StatusCode);
        Assert.Equal("application/problem+json", third.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(third.Headers.RetryAfter);

        using var problem = JsonDocument.Parse(await third.Content.ReadAsStringAsync());
        var root = problem.RootElement;
        Assert.Equal(429, root.GetProperty("status").GetInt32());
        Assert.Equal("Too Many Requests", root.GetProperty("title").GetString());
        Assert.Equal("https://httpstatuses.com/429", root.GetProperty("type").GetString());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task Refresh_shares_the_strict_authentication_budget()
    {
        const string clientIp = "203.0.113.11";

        await PostRefreshAsync(clientIp);
        await PostRefreshAsync(clientIp);
        var throttled = await PostRefreshAsync(clientIp);

        Assert.Equal(HttpStatusCode.TooManyRequests, throttled.StatusCode);
    }

    [Fact]
    public async Task Each_client_address_gets_its_own_budget()
    {
        await PostLoginAsync("203.0.113.20");
        await PostLoginAsync("203.0.113.20");
        var throttled = await PostLoginAsync("203.0.113.20");
        var otherClient = await PostLoginAsync("203.0.113.21");

        Assert.Equal(HttpStatusCode.TooManyRequests, throttled.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, otherClient.StatusCode);
    }

    [Fact]
    public async Task Health_is_never_throttled()
    {
        const string clientIp = "203.0.113.30";

 // Container healthchecks and post-deploy smoke checks poll far above any budget.
        for (var attempt = 0; attempt < 25; attempt++)
        {
            using var health = new HttpRequestMessage(HttpMethod.Get, "/health");
            health.Headers.Add("X-Forwarded-For", clientIp);
            var response = await _client.SendAsync(health);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task Gateway_supplied_client_address_takes_precedence()
    {
 // The gateway resolves the caller once and republishes it, so a stale or forged
 // X-Forwarded-For chain cannot split one caller's budget.
        for (var attempt = 0; attempt < 2; attempt++)
        {
            using var warmup = LoginRequest();
            warmup.Headers.Add("X-Real-IP", "203.0.113.40");
            warmup.Headers.Add("X-Forwarded-For", $"198.51.100.{attempt}");
            await _client.SendAsync(warmup);
        }

        using var throttled = LoginRequest();
        throttled.Headers.Add("X-Real-IP", "203.0.113.40");
        throttled.Headers.Add("X-Forwarded-For", "198.51.100.99");
        var response = await _client.SendAsync(throttled);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task Configured_origin_is_allowed_and_others_are_not()
    {
        using var allowed = new HttpRequestMessage(HttpMethod.Get, "/health");
        allowed.Headers.Add("Origin", AllowedOrigin);
        var allowedResponse = await _client.SendAsync(allowed);

        using var rejected = new HttpRequestMessage(HttpMethod.Get, "/health");
        rejected.Headers.Add("Origin", "https://evil.example.test");
        var rejectedResponse = await _client.SendAsync(rejected);

        Assert.Equal(AllowedOrigin, Header(allowedResponse, "Access-Control-Allow-Origin"));
        Assert.Equal(string.Empty, Header(rejectedResponse, "Access-Control-Allow-Origin"));
    }

    private static HttpRequestMessage LoginRequest() =>
        new(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new PasswordLoginRequest
            {
                Username = "valid-user",
                Password = "wrong-password",
            }),
        };

    private Task<HttpResponseMessage> PostLoginAsync(string clientIp) =>
        SendJsonAsync(
            "/api/auth/login",
            new PasswordLoginRequest { Username = "valid-user", Password = "wrong-password" },
            clientIp);

    private Task<HttpResponseMessage> PostRefreshAsync(string clientIp) =>
        SendJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = "revoked-or-unknown" },
            clientIp);

    private async Task<HttpResponseMessage> SendJsonAsync<TBody>(
        string path,
        TBody body,
        string clientIp)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("X-Forwarded-For", clientIp);

        return await _client.SendAsync(request);
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
            ? string.Join(",", values)
            : string.Empty;
}

/// <summary>
/// Identity API with a two-request authentication budget so throttling is observable, and a
/// single allowed CORS origin so the policy can be asserted both ways.
/// </summary>
public sealed class HardenedIdentityApiWebApplicationFactory
    : WebApplicationFactory<IdentityApi::Program>
{
    public const string AllowedOrigin = "https://app.example.test";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting(
            "ConnectionStrings:Identity",
            "Host=localhost;Database=identity_security_test");
        builder.UseSetting(
            "Jwt:SigningKey",
            "integration-test-signing-key-that-is-at-least-sixty-four-characters-long-1234567890");

 // These are read while services are registered, so they have to be host settings
 // rather than a configuration source added later.
        builder.UseSetting("RateLimiting:Auth:PermitLimit", "2");
        builder.UseSetting("RateLimiting:Global:PermitLimit", "500");
        builder.UseSetting("Cors:AllowedOrigins:0", AllowedOrigin);

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
