extern alias IdentityApi;

using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Swagger UI is served by the same pipeline that hardens the API, so the documentation paths
/// get their own Content-Security-Policy. These tests pin the two facts that make the strict
/// API policy safe to keep: the UI really does need inline script/style, and every asset it
/// pulls is same-origin.
/// </summary>
public class SwaggerUiContentSecurityPolicyTests
    : IClassFixture<SwaggerEnabledIdentityApiWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SwaggerUiContentSecurityPolicyTests(
        SwaggerEnabledIdentityApiWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Swagger_ui_is_served_with_a_policy_that_permits_its_bootstrap()
    {
        var response = await _client.GetAsync("/swagger/index.html");
        var html = await response.Content.ReadAsStringAsync();
        var policy = Header(response, "Content-Security-Policy");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);

        Assert.Contains("script-src 'self';", policy);
        Assert.Contains("style-src 'self' 'unsafe-inline'", policy);
        Assert.DoesNotContain("default-src 'none'", policy);

 // script-src 'self' is only safe while the page has no inline script block. If a
 // Swashbuckle upgrade reintroduces one, relax SecurityHeaders:
 // DocumentationContentSecurityPolicy instead of letting the UI break silently.
        Assert.DoesNotMatch(new Regex(@"<script(?![^>]*\ssrc\s*=)", RegexOptions.IgnoreCase), html);

 // Everything it loads must satisfy 'self'.
        foreach (var source in ExternalSources(html))
            Assert.Fail($"Swagger UI references a cross-origin asset: {source}");
    }

    [Fact]
    public async Task Swagger_document_is_reachable_under_the_documentation_policy()
    {
        var response = await _client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(
            "style-src 'self' 'unsafe-inline'",
            Header(response, "Content-Security-Policy"));
    }

    [Fact]
    public async Task Api_paths_keep_the_strict_policy()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            Header(response, "Content-Security-Policy"));
    }

    private static IEnumerable<string> ExternalSources(string html)
    {
        var matches = Regex.Matches(
            html,
            @"(?:src|href)\s*=\s*[""']([^""']+)[""']",
            RegexOptions.IgnoreCase);

        foreach (var match in matches)
        {
            var value = ((Match)match).Groups[1].Value;
            if (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("//", StringComparison.Ordinal))
            {
                yield return value;
            }
        }
    }

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values)
            ? string.Join(",", values)
            : string.Empty;
}

public sealed class SwaggerEnabledIdentityApiWebApplicationFactory
    : WebApplicationFactory<IdentityApi::Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
 // Swagger UI is mapped in Development and Docker. Docker avoids Identity's
 // Development-only Postgres provisioner, which these pipeline tests never need.
        builder.UseEnvironment("Docker");
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => builder.UseSetting(key, value),
            "Host=localhost;Database=identity_swagger_test");
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
    }
}
