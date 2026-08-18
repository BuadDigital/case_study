using FluentValidation;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Validation;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Platform.Api.Integration;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Platform.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "platform";
    public string OpenApiTitle => "Platform API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Platform;

    public void ConfigureHostOptions(RealEstateEvalApiHostOptions options) =>
        options.CamelCasePropertyNames = true;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.RequireEventBrokerInProduction();
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddClaimsPermissionService();
        builder.Services.AddPlatformInfrastructure(builder.Configuration, connectionString!);
        // A8: Platform boundary validators moved out of the globally scanned assembly.
        builder.Services.AddValidatorsFromAssemblyContaining<CreateCourtRequestValidator>();
        builder.Services.AddMessagingPersistence(builder.Configuration, connectionString!);
        builder.Services.AddRemoteIdentityDirectory(builder.Configuration);
        builder.Services.AddRemoteWorkflowAssignees(builder.Configuration);
        builder.Services.AddPlatformNotificationInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddNotificationIntegrationHandlers();
        builder.Services.AddIntegrationEventInbox();
        builder.Services.AddHostedService<NotificationIntegrationEventConsumer>();
        builder.Services.AddHostedService<NotificationRealtimeIntegrationConsumer>();
        builder.Services.AddHostedService<PushDispatchIntegrationConsumer>();
    }

    public async Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        if (app.Environment.IsDevelopment())
        {
            await using var scope = app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            await PostgresDatabaseProvisioner.EnsureExistsAsync(db.Database.GetConnectionString());
        }

        app.MapDatabaseReady(
            ServiceName,
            typeof(PlatformDbContext),
            typeof(MessagingDbContext));
    }
}
