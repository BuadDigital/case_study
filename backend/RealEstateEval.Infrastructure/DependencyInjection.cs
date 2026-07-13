using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Storage;

namespace RealEstateEval.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddPersistence(configuration, connectionString);
        services.AddIdentityInfrastructure();
        services.AddCaseStudyInfrastructure(configuration);
        return services;
    }

    public static IServiceCollection AddPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));

        var dbOptions = configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
            ?? new DatabaseOptions();
        var pooledConnectionString = NpgsqlConfiguration.EnhanceConnectionString(
            connectionString,
            configuration);

        services.AddDbContextPool<ApplicationDbContext>(options =>
            options.UseNpgsql(pooledConnectionString, npgsql =>
            {
                npgsql.EnableRetryOnFailure(maxRetryCount: 3);
                npgsql.CommandTimeout(dbOptions.CommandTimeoutSeconds);
            }));

        services.AddRedisCaching(configuration);
        return services;
    }

    public static IServiceCollection AddRedisCaching(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RedisCacheOptions>(configuration.GetSection("Redis"));

        var enabled = configuration.GetSection("Redis").GetValue("Enabled", true);
        if (enabled)
        {
            var connectionString = configuration.GetSection("Redis").GetValue<string>("ConnectionString")
                ?? "localhost:6379";
            services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = connectionString;
                options.InstanceName = configuration.GetSection("Redis").GetValue("InstanceName", "ree:");
            });
        }
        else
        {
            services.AddDistributedMemoryCache();
        }

        services.AddSingleton<ApiResponseCache>();
        return services;
    }

    public static IServiceCollection AddIdentityInfrastructure(this IServiceCollection services)
    {
        services
            .AddIdentity<ApplicationUser, IdentityRole>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 6;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
        services.AddScoped<IPermissionService, PermissionService>();
        return services;
    }

    public static IServiceCollection AddBlobStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<BlobStorageOptions>(configuration.GetSection("BlobStorage"));
        services.AddSingleton<IBlobStorage, LocalFileBlobStorage>();
        return services;
    }

    /// <summary>Work orders, workflow tasks, and case-study / party forms.</summary>
    public static IServiceCollection AddCaseStudyCoreInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IWorkOrderService, WorkOrderService>();
        services.AddScoped<IWorkflowTaskService, WorkflowTaskService>();
        services.AddScoped<ICaseStudyFormService, CaseStudyFormService>();
        services.AddScoped<ICaseStudyValuationDispatchService, CaseStudyValuationDispatchService>();
        services.AddScoped<IPartyTaskSubmissionService, PartyTaskSubmissionService>();
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IPoEnfazBillingService, PoEnfazBillingService>();
        services.AddScoped<IFieldInspectionAttachmentVerifier, FieldInspectionAttachmentVerifier>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        return services;
    }

    /// <summary>PO intake drafts, delegation letters, suspended-transaction reads.</summary>
    public static IServiceCollection AddCaseStudyAuxiliaryInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IPoIntakeDraftService, PoIntakeDraftService>();
        services.AddScoped<IInternalDelegationLettersService, InternalDelegationLettersService>();
        services.AddScoped<ISuspendedTransactionsService, SuspendedTransactionsService>();
        return services;
    }

    public static IServiceCollection AddCaseStudyInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddCaseStudyCoreInfrastructure();
        services.AddCaseStudyAuxiliaryInfrastructure();
        services.AddNotificationInfrastructure(configuration);
        services.AddScoped<ISystemMaintenanceService, SystemMaintenanceService>();
        return services;
    }

    public static IServiceCollection AddFailuresInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddNotificationInfrastructure(configuration);
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IPoEnfazBillingService, PoEnfazBillingService>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        services.AddScoped<IWorkflowTaskService, WorkflowTaskService>();
        services.AddScoped<IFailureService, FailureService>();
        services.AddScoped<IFailureTypesCatalogService, FailureTypesCatalogService>();
        return services;
    }

    public static IServiceCollection AddAttachmentsInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IAttachmentService, AttachmentService>();
        return services;
    }

    public static IServiceCollection AddFinancialInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IFinancialReportService, FinancialReportService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        return services;
    }

    public static IServiceCollection AddOperationsInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<ISurveyOfficesService, SurveyOfficesService>();
        services.AddScoped<IPropertyKeysService, PropertyKeysService>();
        return services;
    }

    public static IServiceCollection AddPlatformInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IFieldDictionaryService, FieldDictionaryService>();
        services.AddScoped<ICourtsCatalogService, CourtsCatalogService>();
        services.AddScoped<ICaseStudyInfoRolesConfigService, CaseStudyInfoRolesConfigService>();
        return services;
    }

    /// <summary>Per-user inbox, SSE hub, recipient resolution, and outbox event publishing.</summary>
    public static IServiceCollection AddNotificationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddIntegrationEventPublishing(configuration);
        services.AddSingleton<NotificationRealtimeHub>();
        services.AddSingleton<INotificationRealtimePublisher>(sp =>
            sp.GetRequiredService<NotificationRealtimeHub>());
        services.AddScoped<NotificationRecipientResolver>();
        services.AddScoped<INotificationService, NotificationService>();
        return services;
    }

    public static IServiceCollection AddValuationInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IValuationRequestService, ValuationRequestService>();
        services.AddScoped<IEvaluatorRecallsService, EvaluatorRecallsService>();
        return services;
    }

    /// <summary>
    /// Transactional outbox writer — use on any service that publishes integration events.
    /// Does not start a background dispatcher.
    /// </summary>
    public static IServiceCollection AddIntegrationEventPublishing(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMQ"));
        services.AddScoped<IIntegrationEventPublisher, OutboxIntegrationEventPublisher>();
        return services;
    }

    /// <summary>
    /// Polls <c>OutboxMessages</c> and publishes to RabbitMQ. Register on <b>one</b> service only (case-study).
    /// </summary>
    public static IServiceCollection AddOutboxDispatcher(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMQ"));
        services.AddSingleton<RabbitMqMessagePublisher>();
        services.AddHostedService<OutboxDispatcherHostedService>();
        return services;
    }

    /// <summary>RabbitMQ event handlers for <c>ValuationIntegrationEventConsumer</c> (case-study).</summary>
    public static IServiceCollection AddValuationIntegrationHandlers(this IServiceCollection services)
    {
        services.AddScoped<ValuationReportWorkflowHandler>();
        services.AddScoped<ValuationRequestCreatedHandler>();
        return services;
    }

    /// <summary>RabbitMQ event handlers for <c>NotificationIntegrationEventConsumer</c> (platform).</summary>
    public static IServiceCollection AddNotificationIntegrationHandlers(this IServiceCollection services)
    {
        services.AddScoped<NotificationIntegrationEventHandler>();
        services.AddScoped<NotificationRealtimePushHandler>();
        return services;
    }
}
