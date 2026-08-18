using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Api.Integration;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.CaseStudy.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "case-study";
    public string OpenApiTitle => "Case Study API";
    public string? ConnectionStringKey => ServiceDatabaseNames.CaseStudy;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.RequireEventBrokerInProduction();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddCaseStudyPersistence(builder.Configuration, connectionString!);
        builder.Services.AddMessagingPersistence(builder.Configuration, connectionString!);
        builder.Services.Configure<OutboxDispatcherOptions>(o => o.ContextType = typeof(MessagingDbContext));
        builder.Services.AddClaimsPermissionService();
        builder.Services.AddCaseStudyInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddDevelopmentSystemMaintenance(
            builder.Configuration,
            connectionString!,
            builder.Environment);
        builder.Services.AddIntegrationEventPublishing(builder.Configuration, builder.Environment);
        builder.Services.AddOutboxDispatcher(builder.Configuration, builder.Environment);
        builder.Services.AddValuationIntegrationHandlers();
        builder.Services.AddIntegrationEventInbox();
        builder.Services.AddBlobStorage(builder.Configuration);
        builder.Services.AddHostedService<ValuationIntegrationEventConsumer>();
    }

    public async Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapDatabaseReady(
            ServiceName,
            typeof(CaseStudyDbContext),
            typeof(MessagingDbContext));

        var migrateOnStartup = app.Configuration.GetValue<bool?>("Database:MigrateOnStartup")
            ?? app.Environment.IsDevelopment();
        var seedDemoData = app.Configuration.GetValue<bool>("Database:SeedDemoData");

        if (app.Environment.IsProduction() && migrateOnStartup)
        {
            throw new InvalidOperationException(
                "Database:MigrateOnStartup cannot be enabled in Production. Run the DbMigrate job instead.");
        }

        if (app.Environment.IsProduction() && seedDemoData)
        {
            throw new InvalidOperationException(
                "Database:SeedDemoData cannot be enabled in Production.");
        }

        if (!migrateOnStartup && !seedDemoData)
            return;

        using var scope = app.Services.CreateScope();
        var sp = scope.ServiceProvider;
        if (migrateOnStartup)
        {
            // Apply bounded-context migrations in order. The legacy god-context stream
            // is applied only by the DbMigrate deploy job.
            foreach (var contextType in BoundedContextMigrations.ApplyOrder)
            {
                if (sp.GetService(contextType) is DbContext stream)
                {
                    await PostgresDatabaseProvisioner.EnsureExistsAsync(
                        stream.Database.GetConnectionString());
                    await stream.Database.MigrateAsync();
                }
            }
        }

        if (seedDemoData)
        {
            await using var seedProvider = DependencyInjection.CreateIdentityMaintenanceProvider(
                app.Configuration, connectionString!);
            await DataSeeder.SeedAsync(seedProvider);
        }
    }
}
