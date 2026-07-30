using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("financial");

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

var connectionString = ServiceCollectionExtensions.RequireConnectionString(
    builder.Configuration,
    ServiceDatabaseNames.Financial);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddClaimsPermissionService();
builder.Services.AddFinancialInfrastructure();
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Financial API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Financial API");
app.MapServiceHealth("financial");
app.MapDatabaseReady("financial");
app.MapControllers();

app.Run();

public partial class Program;
