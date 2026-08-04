using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("financial");

builder.Services
    .AddControllers()
    .AddRealEstateEvalValidation()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

var connectionString = ServiceCollectionExtensions.RequireConnectionString(
    builder.Configuration,
    ServiceDatabaseNames.Financial);
builder.Services.AddHostSharedInfrastructure(builder.Configuration);
builder.Services.AddClaimsPermissionService();
builder.Services.AddFinancialInfrastructure(builder.Configuration, connectionString);
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Financial API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Financial API");
app.MapServiceHealth("financial");
app.MapDatabaseReady(
    "financial",
    typeof(FinancialDbContext),
    typeof(CaseStudyDbContext),
    typeof(IdentityDbContext));
app.MapControllers();

app.Run();

public partial class Program;
