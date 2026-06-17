using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("valuation");

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
    ServiceDatabaseNames.Valuation);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddIdentityInfrastructure();
builder.Services.AddCaseStudyInfrastructure();
builder.Services.AddIntegrationMessaging(builder.Configuration);
builder.Services.AddRealEstateEvalJwt(builder.Configuration);
builder.Services.AddRealEstateEvalCors(builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Valuation API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Valuation API");
app.MapServiceHealth("valuation");
app.MapDatabaseReady("valuation");
app.MapControllers();

app.Run();
