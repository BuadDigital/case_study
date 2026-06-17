using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace RealEstateEval.Shared.Web;

public static class ObservabilityExtensions
{
    public static WebApplicationBuilder AddRealEstateEvalObservability(
        this WebApplicationBuilder builder,
        string serviceName)
    {
        var otlpEndpoint = builder.Configuration["OpenTelemetry:OtlpEndpoint"]
            ?? Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT")
            ?? "http://localhost:4317";

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(serviceName))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddOtlpExporter(options => options.Endpoint = new Uri(otlpEndpoint)))
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddOtlpExporter(options => options.Endpoint = new Uri(otlpEndpoint)));

        return builder;
    }
}

public static class ServicePipelineExtensions
{
    public static WebApplication UseRealEstateEvalServicePipeline(this WebApplication app)
    {
        app.UseResponseCompression();
        app.UseCorrelationId();
        if (!app.Environment.IsDevelopment())
            app.UseHttpsRedirection();
        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();
        return app;
    }

    public static WebApplication MapServiceHealth(this WebApplication app, string serviceName)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = serviceName }));
        return app;
    }
}

public static class GatewayPipelineExtensions
{
    public static WebApplication UseRealEstateEvalGatewayPipeline(this WebApplication app)
    {
        app.UseCorrelationId();
        app.UseCors();
        return app;
    }
}
