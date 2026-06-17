using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Reporting.Api.Services;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddHttpClient<IReportingUpstreamClient, ReportingUpstreamClient>();
builder.Services.Configure<RedisCacheOptions>(builder.Configuration.GetSection("Redis"));
builder.Services.AddRedisCaching(builder.Configuration);
builder.Services.AddRealEstateEvalJwt(builder.Configuration);
builder.Services.AddRealEstateEvalCors(builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Reporting API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Reporting API");
app.MapServiceHealth("reporting");
app.MapGet("/ready", () => Results.Ok(new { status = "ready", service = "reporting" }));
app.MapControllers();

app.Run();
