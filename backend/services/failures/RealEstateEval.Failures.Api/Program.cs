using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("failures");

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
    ServiceDatabaseNames.Failures);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddIdentityInfrastructure();
builder.Services.AddFailuresInfrastructure();
builder.Services.AddRealEstateEvalJwt(builder.Configuration);
builder.Services.AddRealEstateEvalCors(builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Failures API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Failures API");
app.MapServiceHealth("failures");
app.MapDatabaseReady("failures");
app.MapControllers();

app.Run();
