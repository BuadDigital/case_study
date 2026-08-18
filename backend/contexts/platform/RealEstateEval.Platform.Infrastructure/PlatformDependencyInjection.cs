using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Infrastructure;

/// <summary>
/// Context-local registration for the Platform bounded context (A8): the reference catalogs
/// (courts, geography, dictionaries, organization settings) and the Platform-owned
/// notification inbox with its SSE and web-push delivery. The shared persistence/messaging
/// plumbing still comes from the global Infrastructure extensions.
/// </summary>
public static class PlatformDependencyInjection
{
    public static IServiceCollection AddPlatformInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddPlatformPersistence(configuration, connectionString);
        services.AddScoped<IAuditLogAppend, PlatformAuditLogAppend>();
        services.AddScoped<IFieldDictionaryService, FieldDictionaryService>();
        services.AddScoped<IAttachmentPrintDictionaryService, AttachmentPrintDictionaryService>();
        services.AddScoped<IDifferenceFactorCatalogService, DifferenceFactorCatalogService>();
        services.AddScoped<ICourtsService, CourtsService>();
        services.AddScoped<ICourtsCatalogService, CourtsCatalogService>();
        services.AddScoped<IRegionsService, RegionsService>();
        services.AddScoped<ICaseStudyInfoRolesConfigService, CaseStudyInfoRolesConfigService>();
        services.AddScoped<IOrganizationSettingsService, OrganizationSettingsService>();
        services.AddScoped<IOtpDeliveryService, OtpDeliveryService>();
        services.AddScoped<IFieldSyncStatusService, FieldSyncStatusService>();
        services.AddScoped<IAuditLogQueryService, AuditLogQueryService>();
        return services;
    }

    /// <summary>Platform-owned per-user inbox and process-local SSE delivery endpoint.</summary>
    public static IServiceCollection AddPlatformNotificationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        // Host must register AddMessagingPersistence against the same connection first.
        services.AddValidatedRabbitMqOptions(configuration, environment);
        // Platform notification writes and their outbox rows must share MessagingDbContext.
        services.AddScoped<IIntegrationEventPublisher, MessagingOutboxPublisher>();
        services.AddSingleton<NotificationRealtimeHub>();
        services.AddSingleton<INotificationRealtimePublisher>(sp =>
            sp.GetRequiredService<NotificationRealtimeHub>());
        services.AddScoped<NotificationRecipientResolver>();
        services.AddScoped<INotificationRecipientResolver>(sp =>
            sp.GetRequiredService<NotificationRecipientResolver>());
        services.AddScoped<INotificationService, NotificationService>();
        services.AddOptions<WebPushOptions>()
            .Bind(configuration.GetSection(WebPushOptions.SectionName))
            .Validate(
                o => !o.Enabled || !string.IsNullOrWhiteSpace(o.PrivateKey),
                "WebPush:PrivateKey is required when WebPush is enabled.")
            .Validate(
                o => !o.Enabled || !string.IsNullOrWhiteSpace(o.PublicKey),
                "WebPush:PublicKey is required when WebPush is enabled.")
            .ValidateOnStart();
        services.AddHttpClient("webpush");
        services.AddScoped<IPushSubscriptionService, PushSubscriptionService>();
        services.AddScoped<WebPushDeliveryHandler>();
        return services;
    }
}
