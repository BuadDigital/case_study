using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Middleware;

namespace RealEstateEval.Api.IntegrationTests;

public class RateLimitingOptionsTests
{
    [Fact]
    public void Defaults_are_strict_outside_development()
    {
        var options = RateLimitingOptions.FromConfiguration(
            EmptyConfiguration(),
            new TestHostEnvironment(Environments.Production));

        Assert.True(options.Enabled);
        Assert.Equal(10, options.Auth.PermitLimit);
        Assert.Equal(600, options.Global.PermitLimit);
        Assert.Equal(60, options.Auth.WindowSeconds);
        Assert.Contains("/api/auth/login", options.AuthPathPrefixes);
        Assert.Contains("/api/auth/refresh", options.AuthPathPrefixes);
        Assert.Contains("/api/auth/login-username", options.AuthPathPrefixes);
        Assert.Contains("/api/auth/dev-login-users", options.AuthPathPrefixes);
        Assert.Contains("/health", options.ExemptPathPrefixes);
        Assert.Contains("/ready", options.ExemptPathPrefixes);
    }

    [Fact]
    public void Defaults_are_lenient_in_development()
    {
        var options = RateLimitingOptions.FromConfiguration(
            EmptyConfiguration(),
            new TestHostEnvironment(Environments.Development));

        Assert.Equal(1_000, options.Auth.PermitLimit);
        Assert.Equal(10_000, options.Global.PermitLimit);
    }

    [Fact]
    public void Configuration_overrides_defaults()
    {
        var options = RateLimitingOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["RateLimiting:Auth:PermitLimit"] = "3",
                ["RateLimiting:Auth:WindowSeconds"] = "30",
                ["RateLimiting:Global:PermitLimit"] = "50",
                ["RateLimiting:AuthPathPrefixes:0"] = "api/auth/login/",
                ["RateLimiting:ExemptPathPrefixes:0"] = "/healthz",
                ["RateLimiting:TrustForwardedForHeader"] = "false",
            }),
            new TestHostEnvironment(Environments.Production));

        Assert.Equal(3, options.Auth.PermitLimit);
        Assert.Equal(TimeSpan.FromSeconds(30), options.Auth.Window);
        Assert.Equal(50, options.Global.PermitLimit);
        Assert.Equal(new[] { "/api/auth/login" }, options.AuthPathPrefixes);
        Assert.Equal(new[] { "/healthz" }, options.ExemptPathPrefixes);
        Assert.False(options.TrustForwardedForHeader);
    }

    [Theory]
    [InlineData("RateLimiting:Auth:PermitLimit", "0")]
    [InlineData("RateLimiting:Global:PermitLimit", "-1")]
    [InlineData("RateLimiting:Auth:WindowSeconds", "0")]
    [InlineData("RateLimiting:Global:WindowSeconds", "3601")]
    [InlineData("RateLimiting:Auth:QueueLimit", "-1")]
    public void Unsafe_limits_are_rejected(string key, string value)
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?> { [key] = value });

        Assert.Throws<InvalidOperationException>(() => RateLimitingOptions.FromConfiguration(
            configuration,
            new TestHostEnvironment(Environments.Production)));
    }

    [Fact]
    public void Limiter_is_registered_when_enabled_and_skipped_when_disabled()
    {
        var enabled = new ServiceCollection();
        enabled.AddRealEstateEvalRateLimiting(
            EmptyConfiguration(),
            new TestHostEnvironment(Environments.Production));

        var enabledOptions = enabled.BuildServiceProvider()
            .GetRequiredService<RateLimitingOptions>();
        Assert.True(enabledOptions.Enabled);

        var disabled = new ServiceCollection();
        disabled.AddRealEstateEvalRateLimiting(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["RateLimiting:Enabled"] = "false",
            }),
            new TestHostEnvironment(Environments.Production));

        var disabledOptions = disabled.BuildServiceProvider()
            .GetRequiredService<RateLimitingOptions>();
        Assert.False(disabledOptions.Enabled);
    }

    private static IConfiguration EmptyConfiguration() =>
        BuildConfiguration(new Dictionary<string, string?>());

    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}

public class SecurityHeadersOptionsTests
{
    [Fact]
    public void Api_policy_denies_everything_by_default()
    {
        var options = SecurityHeadersOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>()),
            new TestHostEnvironment(Environments.Production));

        Assert.Equal(
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            options.ContentSecurityPolicy);
        Assert.Equal("DENY", options.FrameOptions);
        Assert.Equal("no-referrer", options.ReferrerPolicy);
        Assert.Contains("/swagger", options.DocumentationPathPrefixes);
    }

    [Fact]
    public void Documentation_policy_keeps_swagger_ui_working()
    {
        var options = SecurityHeadersOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>()),
            new TestHostEnvironment(Environments.Production));

 // Swagger UI loads its assets as same-origin files but sets inline style attributes,
 // and "Try it out" calls the API it documents.
        Assert.Contains("script-src 'self';", options.DocumentationContentSecurityPolicy);
        Assert.DoesNotContain("script-src 'self' 'unsafe-inline'", options.DocumentationContentSecurityPolicy);
        Assert.Contains("style-src 'self' 'unsafe-inline'", options.DocumentationContentSecurityPolicy);
        Assert.Contains("connect-src 'self'", options.DocumentationContentSecurityPolicy);
        Assert.DoesNotContain("default-src 'none'", options.DocumentationContentSecurityPolicy);
    }

    [Fact]
    public void Hsts_is_enabled_outside_development_only()
    {
        var production = SecurityHeadersOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>()),
            new TestHostEnvironment(Environments.Production));
        var development = SecurityHeadersOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>()),
            new TestHostEnvironment(Environments.Development));

        Assert.True(production.EnableHsts);
        Assert.False(development.EnableHsts);
        Assert.Equal("max-age=31536000; includeSubDomains", production.BuildStrictTransportSecurity());
    }

    [Fact]
    public void Configuration_overrides_policies()
    {
        var options = SecurityHeadersOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["SecurityHeaders:ContentSecurityPolicy"] = "default-src 'self'",
                ["SecurityHeaders:FrameOptions"] = "SAMEORIGIN",
                ["SecurityHeaders:DocumentationPathPrefixes:0"] = "docs",
                ["SecurityHeaders:Hsts:MaxAgeSeconds"] = "120",
                ["SecurityHeaders:Hsts:IncludeSubDomains"] = "false",
            }),
            new TestHostEnvironment(Environments.Production));

        Assert.Equal("default-src 'self'", options.ContentSecurityPolicy);
        Assert.Equal("SAMEORIGIN", options.FrameOptions);
        Assert.Equal(new[] { "/docs" }, options.DocumentationPathPrefixes);
        Assert.Equal("max-age=120", options.BuildStrictTransportSecurity());
    }

    [Fact]
    public void Preload_without_subdomains_is_rejected()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["SecurityHeaders:Hsts:Preload"] = "true",
            ["SecurityHeaders:Hsts:IncludeSubDomains"] = "false",
        });

        Assert.Throws<InvalidOperationException>(() => SecurityHeadersOptions.FromConfiguration(
            configuration,
            new TestHostEnvironment(Environments.Production)));
    }

    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}

public class CorsOptionsTests
{
    [Fact]
    public void Origins_are_normalized_and_deduplicated()
    {
        var options = RealEstateEvalCorsOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "https://app.example.test/",
                ["Cors:AllowedOrigins:1"] = "https://app.example.test",
                ["Cors:AllowedOrigins:2"] = "http://shell.example.test:3000",
            }),
            new TestHostEnvironment(Environments.Production));

        Assert.Equal(
            new[] { "https://app.example.test", "http://shell.example.test:3000" },
            options.AllowedOrigins);
        Assert.False(options.WarnOnMissingOrigins);
    }

    [Theory]
    [InlineData("*")]
    [InlineData("app.example.test")]
    [InlineData("https://app.example.test/path")]
    [InlineData("ftp://app.example.test")]
    public void Invalid_origins_are_rejected(string origin)
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Cors:AllowedOrigins:0"] = origin,
        });

        Assert.Throws<InvalidOperationException>(() => RealEstateEvalCorsOptions.FromConfiguration(
            configuration,
            new TestHostEnvironment(Environments.Production)));
    }

    [Fact]
    public void Missing_origins_outside_development_are_announced_loudly()
    {
        var options = RealEstateEvalCorsOptions.FromConfiguration(
            BuildConfiguration(new Dictionary<string, string?>()),
            new TestHostEnvironment(Environments.Production));

        Assert.Empty(options.AllowedOrigins);
        Assert.True(options.WarnOnMissingOrigins);
    }

    [Fact]
    public void Missing_origins_outside_development_can_fail_fast()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Cors:RequireAllowedOrigins"] = "true",
        });

        Assert.Throws<InvalidOperationException>(() => RealEstateEvalCorsOptions.FromConfiguration(
            configuration,
            new TestHostEnvironment(Environments.Production)));

 // Development keeps working on the localhost defaults.
        RealEstateEvalCorsOptions.FromConfiguration(
            configuration,
            new TestHostEnvironment(Environments.Development));
    }

    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}

internal sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = environmentName;
    public string ApplicationName { get; set; } = nameof(TestHostEnvironment);
    public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
