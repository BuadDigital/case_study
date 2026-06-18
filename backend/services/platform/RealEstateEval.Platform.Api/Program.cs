using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("platform");

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

var connectionString = ServiceCollectionExtensions.RequireConnectionString(
    builder.Configuration,
    ServiceDatabaseNames.Platform);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddIdentityInfrastructure();
builder.Services.AddRealEstateEvalJwt(builder.Configuration);
builder.Services.AddRealEstateEvalCors(builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Platform API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Platform API");
app.MapServiceHealth("platform");
app.MapDatabaseReady("platform");
app.MapControllers();

app.Run();
