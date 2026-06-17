using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("identity");

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
    ServiceDatabaseNames.Identity);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddIdentityInfrastructure();
builder.Services.AddRealEstateEvalJwt(builder.Configuration);
builder.Services.AddRealEstateEvalCors(builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Identity API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Identity API");
app.MapServiceHealth("identity");
app.MapDatabaseReady("identity");
app.MapControllers();

app.Run();
