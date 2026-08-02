using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Api.Integration;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);
builder.AddRealEstateEvalObservability("case-study");

builder.Services
    .AddControllers()
    .AddRealEstateEvalValidation()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddHttpContextAccessor();
var connectionString = ServiceCollectionExtensions.RequireConnectionString( builder.Configuration, ServiceDatabaseNames.CaseStudy);
builder.Services.AddPersistence(builder.Configuration, connectionString);
builder.Services.AddPlatformPersistence(builder.Configuration, connectionString);
builder.Services.AddScoped<IOrganizationSettingsService, OrganizationSettingsService>();
builder.Services.AddClaimsPermissionService();
builder.Services.AddCaseStudyInfrastructure(builder.Configuration, builder.Environment);
builder.Services.AddDevelopmentSystemMaintenance(
    builder.Configuration,
    connectionString,
    builder.Environment);
builder.Services.AddValuationRequestInfrastructure(builder.Configuration, connectionString);
builder.Services.AddIntegrationEventPublishing(builder.Configuration, builder.Environment);
builder.Services.AddOutboxDispatcher(builder.Configuration, builder.Environment);
builder.Services.AddValuationIntegrationHandlers();
builder.Services.AddIntegrationEventInbox();
builder.Services.AddBlobStorage(builder.Configuration);
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Case Study API");
builder.Services.AddHostedService<ValuationIntegrationEventConsumer>();

// MigrateOnStartup defaults on only in Development. Production must use the
// deploy-time DbMigrate job (see infra/docker-compose.prod.yml + backend/tools/DbMigrate).
var migrateOnStartup = builder.Configuration.GetValue<bool?>("Database:MigrateOnStartup") ?? builder.Environment.IsDevelopment();
var seedDemoData = builder.Configuration.GetValue<bool>("Database:SeedDemoData");

if (builder.Environment.IsProduction() && migrateOnStartup)
{
    throw new InvalidOperationException("Database:MigrateOnStartup cannot be enabled in Production. Run the DbMigrate job instead.");
}

if (builder.Environment.IsProduction() && seedDemoData)
{
    throw new InvalidOperationException(
        "Database:SeedDemoData cannot be enabled in Production.");
}

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Case Study API");
app.MapServiceHealth("case-study");
app.MapDatabaseReady("case-study");
app.MapControllers();

if (migrateOnStartup || seedDemoData)
{
    using var scope = app.Services.CreateScope();
    var sp = scope.ServiceProvider;
    if (migrateOnStartup)
    {
        // Same order as the deploy job: frozen legacy stream first, then whichever bounded
        // contexts this process registers (backend/tools/DbMigrate covers all of them).
        await sp.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
        foreach (var contextType in BoundedContextMigrations.ApplyOrder)
        {
            if (sp.GetService(contextType) is DbContext stream)
                await stream.Database.MigrateAsync();
        }
    }

    if (seedDemoData)
    {
        // Demo seeding needs Identity stores; request paths use claims-based permissions.
        await using var seedProvider = RealEstateEval.Infrastructure.DependencyInjection.CreateIdentityMaintenanceProvider(app.Configuration,connectionString);
        await DataSeeder.SeedAsync(seedProvider);
    }
}

app.Run();