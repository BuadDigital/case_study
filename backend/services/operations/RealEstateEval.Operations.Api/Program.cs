using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("operations");

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
    ServiceDatabaseNames.Operations);
builder.Services.AddHostSharedInfrastructure(builder.Configuration);
builder.Services.AddClaimsPermissionService();
builder.Services.AddOperationsInfrastructure(builder.Configuration, connectionString, builder.Environment);
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Operations API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Operations API");
app.MapServiceHealth("operations");
app.MapDatabaseReady(
    "operations",
    typeof(OperationsDbContext),
    typeof(FailuresDbContext),
    typeof(CaseStudyDbContext),
    typeof(FinancialDbContext),
    typeof(IdentityDbContext),
    typeof(AttachmentsDbContext));
app.MapControllers();

app.Run();

public partial class Program;
