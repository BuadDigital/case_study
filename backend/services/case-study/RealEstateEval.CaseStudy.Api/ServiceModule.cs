using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Validation;
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
        // A8: Case Study boundary validators moved out of the globally scanned assembly.
        builder.Services.AddValidatorsFromAssemblyContaining<CreateWorkOrderRequestValidator>();
        // No Identity EF / registration services on the request host — request paths use the
        // Identity HTTP directory; Dev seed runs through CreateIdentityMaintenanceProvider.
        builder.Services.AddIntegrationEventPublishing(builder.Configuration, builder.Environment);
        builder.Services.AddOutboxDispatcher(builder.Configuration, builder.Environment);
        builder.Services.AddValuationIntegrationHandlers();
        builder.Services.AddIntegrationEventInbox();
        // A8: dead AddBlobStorage registration removed — nothing on this host resolves IBlobStorage.
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
            // Apply the registered bounded-context streams in catalog order. The legacy
            // god-context stream is applied only by the DbMigrate deploy job. (A8: the
            // catalog is name-keyed; hosts enumerate their own stream registrations.)
            var streams = sp.GetServices<BoundedContextStreamRegistration>()
                .DistinctBy(registration => registration.ContextType)
                .ToList();
            foreach (var contextName in BoundedContextMigrations.ApplyOrder)
            {
                var registration = streams.FirstOrDefault(r =>
                    string.Equals(r.ContextType.Name, contextName, StringComparison.Ordinal));
                if (registration is not null
                    && sp.GetService(registration.ContextType) is DbContext stream)
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
