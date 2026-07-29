using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Configuration;

namespace RealEstateEval.Reporting.Api.Services;

public sealed class ReportingHttpResilienceOptions
{
    public const string SectionName = "ReportingHttpResilience";

    [Range(1, 120)]
    public int TotalTimeoutSeconds { get; set; } = 15;

    [Range(1, 60)]
    public int AttemptTimeoutSeconds { get; set; } = 4;

    [Range(0, 5)]
    public int RetryCount { get; set; } = 2;

    [Range(0, 30_000)]
    public int RetryDelayMilliseconds { get; set; } = 200;

    [Range(0.01, 1.0)]
    public double CircuitBreakerFailureRatio { get; set; } = 0.5;

    [Range(2, 1_000)]
    public int CircuitBreakerMinimumThroughput { get; set; } = 10;

    [Range(2, 300)]
    public int CircuitBreakerSamplingSeconds { get; set; } = 30;

    [Range(1, 300)]
    public int CircuitBreakerBreakSeconds { get; set; } = 15;

    public static ReportingHttpResilienceOptions FromConfiguration(IConfiguration configuration)
    {
        var options = configuration
            .GetSection(SectionName)
            .Get<ReportingHttpResilienceOptions>() ?? new ReportingHttpResilienceOptions();

        Validator.ValidateObject(options, new ValidationContext(options), validateAllProperties: true);

        if (options.AttemptTimeoutSeconds >= options.TotalTimeoutSeconds)
        {
            throw new ValidationException(
                $"{SectionName}:AttemptTimeoutSeconds must be less than TotalTimeoutSeconds.");
        }

        if (options.CircuitBreakerSamplingSeconds < options.AttemptTimeoutSeconds * 2)
        {
            throw new ValidationException(
                $"{SectionName}:CircuitBreakerSamplingSeconds must be at least twice AttemptTimeoutSeconds.");
        }

        return options;
    }
}
