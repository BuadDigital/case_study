extern alias ReportingApi;

using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Configuration;
using ReportingHttpResilienceOptions =
    ReportingApi::RealEstateEval.Reporting.Api.Services.ReportingHttpResilienceOptions;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class ReportingHttpResilienceOptionsTests
{
    [Fact]
    public void FromConfiguration_binds_configured_limits()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["ReportingHttpResilience:TotalTimeoutSeconds"] = "12",
            ["ReportingHttpResilience:AttemptTimeoutSeconds"] = "3",
            ["ReportingHttpResilience:RetryCount"] = "1",
            ["ReportingHttpResilience:CircuitBreakerMinimumThroughput"] = "7",
        });

        var options = ReportingHttpResilienceOptions.FromConfiguration(configuration);

        Assert.Equal(12, options.TotalTimeoutSeconds);
        Assert.Equal(3, options.AttemptTimeoutSeconds);
        Assert.Equal(1, options.RetryCount);
        Assert.Equal(7, options.CircuitBreakerMinimumThroughput);
    }

    [Theory]
    [InlineData("AttemptTimeoutSeconds", "15")]
    [InlineData("RetryCount", "6")]
    [InlineData("CircuitBreakerSamplingSeconds", "7")]
    public void FromConfiguration_rejects_unsafe_limits(string key, string value)
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            [$"ReportingHttpResilience:{key}"] = value,
        });

        Assert.Throws<ValidationException>(
            () => ReportingHttpResilienceOptions.FromConfiguration(configuration));
    }

    private static IConfiguration BuildConfiguration(
        Dictionary<string, string?> values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
}
