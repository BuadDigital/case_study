using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("failures");

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
    ServiceDatabaseNames.Failures);
builder.Services.AddHostSharedInfrastructure(builder.Configuration);
builder.Services.AddClaimsPermissionService();
builder.Services.AddFailuresInfrastructure(builder.Configuration, connectionString, builder.Environment);
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Failures API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Failures API");
app.MapServiceHealth("failures");
app.MapDatabaseReady(
    "failures",
    typeof(FailuresDbContext),
    typeof(CaseStudyDbContext),
    typeof(IdentityDbContext),
    typeof(MessagingDbContext));
app.MapControllers();

app.Run();

public partial class Program;
