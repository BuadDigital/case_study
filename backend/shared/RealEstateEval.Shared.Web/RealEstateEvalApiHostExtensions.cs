using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Shared.Web.Middleware;

namespace RealEstateEval.Shared.Web;

public sealed class RealEstateEvalApiHostOptions
{
    /// <summary>Register FluentValidation action filters. Default is on.</summary>
    public bool AddValidation { get; set; } = true;

    /// <summary>
    /// Set camelCase JSON names explicitly. ASP.NET Core already defaults to camelCase;
    /// keep this for hosts that historically set the policy in ServiceModule.
    /// </summary>
    public bool CamelCasePropertyNames { get; set; }
}

public static class RealEstateEvalApiHostExtensions
{
    public static WebApplicationBuilder AddRealEstateEvalApiHost(
        this WebApplicationBuilder builder,
        string serviceName,
        string openApiTitle,
        Action<RealEstateEvalApiHostOptions>? configure = null)
    {
        var options = new RealEstateEvalApiHostOptions();
        configure?.Invoke(options);

        builder.AddRealEstateEvalObservability(serviceName);

        var mvc = builder.Services.AddControllers();
        mvc.AddMvcOptions(o => o.Conventions.Add(new CanonicalV1AliasConvention()));
        if (options.AddValidation)
            mvc.AddRealEstateEvalValidation();

        mvc.AddJsonOptions(json =>
        {
            if (options.CamelCasePropertyNames)
            {
                json.JsonSerializerOptions.PropertyNamingPolicy =
                    JsonNamingPolicy.CamelCase;
            }

            json.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        builder.Services.AddResponseCompression(compression =>
            compression.EnableForHttps = true);
        builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
        builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
        builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
        builder.Services.AddRealEstateEvalOpenApi(openApiTitle);
        builder.Services.AddCommandIdempotency();
        return builder;
    }

    public static WebApplication MapRealEstateEvalApiHost(
        this WebApplication app,
        string serviceName,
        string openApiTitle)
    {
        app.UseRealEstateEvalServicePipeline();
        app.UseRealEstateEvalOpenApi(openApiTitle);
        app.MapServiceHealth(serviceName);
        return app;
    }
}
