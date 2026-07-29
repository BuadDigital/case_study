using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
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
        string connectionString,
        IHostEnvironment environment)
    {
        services.AddPersistence(configuration, connectionString);
        services.AddIdentityInfrastructure();
        services.AddCaseStudyInfrastructure(configuration, environment);
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
                options.Password.RequiredLength = 12;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IAuthSessionService, AuthSessionService>();
        services.AddScoped<IPasswordAuthenticationService, PasswordAuthenticationService>();
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
        services.AddScoped<IFieldInspectionWorkspaceService, FieldInspectionWorkspaceService>();
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IPoEnfazBillingService, PoEnfazBillingService>();
        services.AddScoped<IEngineeringBillingStatementService, EngineeringBillingStatementService>();
        services.AddScoped<IFieldInspectionAttachmentVerifier, FieldInspectionAttachmentVerifier>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        services.AddScoped<IFailureService, FailureService>();
        services.AddScoped<IPropertyKeyGateResolver, PropertyKeyGateResolver>();
        services.AddScoped<IPropertyAccessHoldService, PropertyAccessHoldService>();
        services.AddScoped<IKeyEnvelopesService, KeyEnvelopesService>();
        return services;
    }

    /// <summary>PO intake drafts, delegation letters, suspended-transaction reads.</summary>
    public static IServiceCollection AddCaseStudyAuxiliaryInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IPoIntakeDraftService, PoIntakeDraftService>();
        services.AddScoped<IOperationsTaskService, OperationsTaskService>();
        services.AddHostedService<OperationsTaskReminderHostedService>();
        services.AddScoped<ISuspendedTransactionsService, SuspendedTransactionsService>();
        return services;
    }

    public static IServiceCollection AddCaseStudyInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddCaseStudyCoreInfrastructure();
        services.AddCaseStudyAuxiliaryInfrastructure();
        services.AddNotificationInfrastructure(configuration, environment);
        services.AddScoped<ISystemMaintenanceService, SystemMaintenanceService>();
        return services;
    }

    public static IServiceCollection AddFailuresInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddNotificationInfrastructure(configuration, environment);
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IPoEnfazBillingService, PoEnfazBillingService>();
        services.AddScoped<IEngineeringBillingStatementService, EngineeringBillingStatementService>();
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
        services.AddScoped<IPropertyKeyGateResolver, PropertyKeyGateResolver>();
        services.AddScoped<IPropertyAccessHoldService, PropertyAccessHoldService>();
        services.AddScoped<IKeyEnvelopesService, KeyEnvelopesService>();
        return services;
    }

    public static IServiceCollection AddPlatformInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IFieldDictionaryService, FieldDictionaryService>();
        services.AddScoped<ICourtsService, CourtsService>();
        services.AddScoped<ICourtsCatalogService, CourtsCatalogService>();
        services.AddScoped<IRegionsService, RegionsService>();
        services.AddScoped<ICaseStudyInfoRolesConfigService, CaseStudyInfoRolesConfigService>();
        return services;
    }

    /// <summary>Per-user inbox, SSE hub, recipient resolution, and outbox event publishing.</summary>
    public static IServiceCollection AddNotificationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddIntegrationEventPublishing(configuration, environment);
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
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddValidatedRabbitMqOptions(configuration, environment);
        services.AddScoped<IIntegrationEventPublisher, OutboxIntegrationEventPublisher>();
        return services;
    }

    /// <summary>
    /// Deduplication store for services that consume integration events.
    /// </summary>
    public static IServiceCollection AddIntegrationEventInbox(this IServiceCollection services)
    {
        services.AddScoped<IIntegrationEventInbox, IntegrationEventInbox>();
        return services;
    }

    /// <summary>
    /// Polls <c>OutboxMessages</c> and publishes to RabbitMQ. Register on <b>one</b> service only (case-study).
    /// </summary>
    public static IServiceCollection AddOutboxDispatcher(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddValidatedRabbitMqOptions(configuration, environment);
        services.AddSingleton<RabbitMqMessagePublisher>();
        services.AddHostedService<OutboxDispatcherHostedService>();
        return services;
    }

    public static IServiceCollection AddValidatedRabbitMqOptions(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddOptions<RabbitMqOptions>()
            .Bind(configuration.GetSection("RabbitMQ"))
            .Validate(
                options => !options.Enabled
                    || !string.IsNullOrWhiteSpace(options.Host),
                "RabbitMQ:Host is required when RabbitMQ is enabled.")
            .Validate(
                options => !options.Enabled
                    || environment.IsDevelopment()
                    || (!string.IsNullOrWhiteSpace(options.UserName)
                        && !options.UserName.Equals("dev", StringComparison.OrdinalIgnoreCase)),
                "RabbitMQ:UserName must be configured and cannot use the development default outside Development.")
            .Validate(
                options => !options.Enabled
                    || environment.IsDevelopment()
                    || (!string.IsNullOrWhiteSpace(options.Password)
                        && options.Password.Length >= 16
                        && !options.Password.Equals("dev", StringComparison.OrdinalIgnoreCase)),
                "RabbitMQ:Password must be at least 16 characters and cannot use the development default outside Development.")
            .ValidateOnStart();

        return services;
    }

    /// <summary>RabbitMQ event handlers for <c>ValuationIntegrationEventConsumer</c> (case-study).</summary>
    public static IServiceCollection AddValuationIntegrationHandlers(this IServiceCollection services)
    {
        services.AddScoped<ValuationReportWorkflowHandler>();
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
