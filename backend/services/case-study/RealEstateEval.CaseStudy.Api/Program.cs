using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Api.Integration;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);
builder.AddRealEstateEvalObservability("case-study");

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
var connectionString = ServiceCollectionExtensions.RequireConnectionString( builder.Configuration, ServiceDatabaseNames.CaseStudy);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddIdentityInfrastructure();
builder.Services.AddCaseStudyInfrastructure(builder.Configuration);
builder.Services.AddValuationInfrastructure();
builder.Services.AddIntegrationEventPublishing(builder.Configuration);
builder.Services.AddOutboxDispatcher(builder.Configuration);
builder.Services.AddValuationIntegrationHandlers();
builder.Services.AddBlobStorage(builder.Configuration);
builder.Services.AddRealEstateEvalJwt(builder.Configuration);
builder.Services.AddRealEstateEvalCors(builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Case Study API");
builder.Services.AddHostedService<ValuationIntegrationEventConsumer>();

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Case Study API");
app.MapServiceHealth("case-study");
app.MapDatabaseReady("case-study");
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var sp = scope.ServiceProvider;
    var db = sp.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
    await DataSeeder.SeedAsync(sp);
}

app.Run();