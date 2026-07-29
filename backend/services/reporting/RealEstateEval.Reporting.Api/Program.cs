using Microsoft.Extensions.Http.Resilience;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Reporting.Api.Services;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);
var httpResilience = ReportingHttpResilienceOptions.FromConfiguration(builder.Configuration);

builder.AddRealEstateEvalObservability("reporting");

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
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
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Reporting API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Reporting API");
app.MapServiceHealth("reporting");
app.MapGet("/ready", () => Results.Ok(new { status = "ready", service = "reporting" }));
app.MapControllers();

app.Run();
