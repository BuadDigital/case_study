using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Api.IntegrationTests;

public class JwtConfigurationValidationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short-key")]
    [InlineData("CHANGE_ME_IN_PRODUCTION_USE_64_CHARS_MINIMUM_FOR_HMAC_SHA256_123456789")]
    [InlineData("DEV_ONLY_SIGNING_KEY_THAT_IS_LONG_ENOUGH_BUT_NOT_SAFE_FOR_PRODUCTION_12345")]
    public void AddJwt_rejects_missing_weak_or_placeholder_key_in_production(string? signingKey)
    {
        var configuration = BuildConfiguration(signingKey);
        var services = new ServiceCollection();
        var environment = new TestHostEnvironment(Environments.Production);

        Assert.Throws<InvalidOperationException>(
            () => services.AddRealEstateEvalJwt(configuration, environment));
    }

    [Fact]
    public void AddJwt_accepts_strong_non_placeholder_key_in_production()
    {
        var configuration = BuildConfiguration(
            "production-test-key-with-more-than-sixty-four-characters-and-no-placeholder-123456");
        var services = new ServiceCollection();
        var environment = new TestHostEnvironment(Environments.Production);

        services.AddRealEstateEvalJwt(configuration, environment);
    }

    [Fact]
    public void AddJwt_allows_development_placeholder_for_local_workflows()
    {
        var configuration = BuildConfiguration("CHANGE_ME_DEV_ONLY");
        var services = new ServiceCollection();
        var environment = new TestHostEnvironment(Environments.Development);

        services.AddRealEstateEvalJwt(configuration, environment);
    }

    private static IConfiguration BuildConfiguration(string? signingKey)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "RealEstateEval",
                ["Jwt:Audience"] = "RealEstateEval",
                ["Jwt:SigningKey"] = signingKey,
            })
            .Build();
    }

    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = nameof(JwtConfigurationValidationTests);
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
