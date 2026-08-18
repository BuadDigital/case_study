using Microsoft.Extensions.Http.Resilience;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Reporting.Api.Services;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Reporting.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "reporting";
    public string OpenApiTitle => "Reporting API";
    public string? ConnectionStringKey => null;

    public void ConfigureHostOptions(RealEstateEvalApiHostOptions options) =>
        options.AddValidation = false;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        var httpResilience = ReportingHttpResilienceOptions.FromConfiguration(builder.Configuration);

        builder.Services.AddHttpContextAccessor();
        builder.Services.Configure<UpstreamServicesOptions>(
            builder.Configuration.GetSection("UpstreamServices"));
        builder.Services.AddSingleton(httpResilience);
        builder.Services
            .AddHttpClient<IReportingUpstreamClient, ReportingUpstreamClient>(client =>
            {
                // The resilience pipeline owns both per-attempt and total request timeouts.
                client.Timeout = Timeout.InfiniteTimeSpan;
            })
            .AddStandardResilienceHandler(options =>
            {
                options.TotalRequestTimeout.Timeout =
                    TimeSpan.FromSeconds(httpResilience.TotalTimeoutSeconds);
                options.AttemptTimeout.Timeout =
                    TimeSpan.FromSeconds(httpResilience.AttemptTimeoutSeconds);
                options.Retry.MaxRetryAttempts = httpResilience.RetryCount;
                options.Retry.Delay =
                    TimeSpan.FromMilliseconds(httpResilience.RetryDelayMilliseconds);
                options.Retry.DisableForUnsafeHttpMethods();
                options.CircuitBreaker.FailureRatio =
                    httpResilience.CircuitBreakerFailureRatio;
                options.CircuitBreaker.MinimumThroughput =
                    httpResilience.CircuitBreakerMinimumThroughput;
                options.CircuitBreaker.SamplingDuration =
                    TimeSpan.FromSeconds(httpResilience.CircuitBreakerSamplingSeconds);
                options.CircuitBreaker.BreakDuration =
                    TimeSpan.FromSeconds(httpResilience.CircuitBreakerBreakSeconds);
            });
        builder.Services.Configure<RedisCacheOptions>(builder.Configuration.GetSection("Redis"));
        builder.Services.AddRedisCaching(builder.Configuration);
    }

    public Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapStatelessReady(ServiceName);
        return Task.CompletedTask;
    }
}
