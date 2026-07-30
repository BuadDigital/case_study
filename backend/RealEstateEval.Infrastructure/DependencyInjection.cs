using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Storage;

namespace RealEstateEval.Infrastructure;

public static class DependencyInjection
{
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

    /// <summary>Attachments write context (ADR 0003, plan Phase 1).</summary>
    public static IServiceCollection AddAttachmentsPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString) =>
        services.AddBoundedContextPersistence<AttachmentsDbContext>(configuration, connectionString);

    /// <summary>Platform catalog write context (ADR 0003, plan Phase 1).</summary>
    public static IServiceCollection AddPlatformPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString) =>
        services.AddBoundedContextPersistence<PlatformDbContext>(configuration, connectionString);

    /// <summary>Valuation write context, including its own outbox rows (ADR 0003, D5).</summary>
    public static IServiceCollection AddValuationPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString) =>
        services.AddBoundedContextPersistence<ValuationDbContext>(configuration, connectionString);

    /// <summary>
    /// Registers one bounded-context pool against the same physical database as the legacy
    /// context. Phase 1 separates models and migration streams, not connections: only the
    /// migrations-history table differs, so each stream records itself in the schema it owns.
    /// </summary>
    private static IServiceCollection AddBoundedContextPersistence<TContext>(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
        where TContext : DbContext
    {
        var dbOptions = configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
            ?? new DatabaseOptions();
        var pooledConnectionString = NpgsqlConfiguration.EnhanceConnectionString(
            connectionString,
            configuration);

        services.AddDbContextPool<TContext>(options =>
            options.UseNpgsql(pooledConnectionString, npgsql =>
            {
                npgsql.EnableRetryOnFailure(maxRetryCount: 3);
                npgsql.CommandTimeout(dbOptions.CommandTimeoutSeconds);
                npgsql.MigrationsHistoryTable(
                    BoundedContextMigrations.HistoryTable,
                    BoundedContextMigrations.HistorySchemaFor<TContext>());
            }));

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

    /// <summary>Identity write context (ADR 0003, plan Phase 1 extraction step 2).</summary>
    public static IServiceCollection AddIdentityPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString) =>
        services.AddBoundedContextPersistence<IdentityDbContext>(configuration, connectionString);

    /// <summary>
    /// ASP.NET Identity stores and Identity write/permission services. Callers must register
    /// <see cref="IdentityDbContext"/> first (via <see cref="AddIdentityPersistence"/> or a
    /// test InMemory registration).
    /// </summary>
    public static IServiceCollection AddIdentityApplicationServices(this IServiceCollection services)
    {
        services.AddIdentityStores();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IAuthSessionService, AuthSessionService>();
        services.AddScoped<IPasswordAuthenticationService, PasswordAuthenticationService>();
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
        services.AddScoped<IPermissionService, PermissionService>();
        return services;
    }

    /// <summary>
    /// Full Identity host registration: stores, session/auth writes, and database-backed
    /// permission resolution. Only the Identity API (and Identity-focused tests/tools) should
    /// call this.
    /// </summary>
    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddIdentityPersistence(configuration, connectionString);
        services.AddIdentityApplicationServices();
        return services;
    }

    /// <summary>
    /// ASP.NET Identity stores against <see cref="IdentityDbContext"/>. Used by the Identity
    /// host and by Development seeding hosts that still need <see cref="UserManager{TUser}"/>.
    /// </summary>
    public static IServiceCollection AddIdentityStores(this IServiceCollection services)
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
            .AddEntityFrameworkStores<IdentityDbContext>()
            .AddDefaultTokenProviders();

        services.Configure<DataProtectionTokenProviderOptions>(options =>
            options.TokenLifespan = TimeSpan.FromHours(24));

        return services;
    }

    /// <summary>
    /// Resolves the caller's permissions from JWT claims. Non-Identity APIs use this instead of
    /// opening Identity stores (plan Phase 1 extraction step 2).
    /// </summary>
    public static IServiceCollection AddClaimsPermissionService(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<IPermissionService, ClaimsPermissionService>();
        return services;
    }

    /// <summary>
    /// Development-only Identity stores for demo seeding. Does not register auth write services
    /// or database-backed <see cref="IPermissionService"/> — request paths still use claims.
    /// </summary>
    public static IServiceCollection AddIdentitySeedStores(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddIdentityPersistence(configuration, connectionString);
        services.AddIdentityStores();
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
        services.AddScoped<IWorkflowTaskVisibilityFilter, WorkflowTaskVisibilityFilter>();
        services.AddScoped<IWorkOrderVisibilityFilter, WorkOrderVisibilityFilter>();
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
        services.AddScoped<IKeyEnvelopePeopleResolver, KeyEnvelopePeopleResolver>();
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
        return services;
    }

    /// <summary>
    /// Development-only reset support. Identity stores stay out of normal Case Study request
    /// paths and are registered only because the reset operation deletes and re-seeds demo users.
    /// </summary>
    public static IServiceCollection AddDevelopmentSystemMaintenance(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        if (!environment.IsDevelopment()) return services;

        services.AddIdentitySeedStores(configuration, connectionString);
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
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

    public static IServiceCollection AddAttachmentsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddAttachmentsPersistence(configuration, connectionString);
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
        services.AddScoped<IKeyEnvelopePeopleResolver, KeyEnvelopePeopleResolver>();
        services.AddScoped<IKeyEnvelopesService, KeyEnvelopesService>();
        return services;
    }

    public static IServiceCollection AddPlatformInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddPlatformPersistence(configuration, connectionString);
        services.AddScoped<IFieldDictionaryService, FieldDictionaryService>();
        services.AddScoped<ICourtsService, CourtsService>();
        services.AddScoped<ICourtsCatalogService, CourtsCatalogService>();
        services.AddScoped<IRegionsService, RegionsService>();
        services.AddScoped<ICaseStudyInfoRolesConfigService, CaseStudyInfoRolesConfigService>();
        return services;
    }

    /// <summary>
    /// Notification commands for non-owner services. Recipients are resolved locally, then
    /// persistence is requested from Platform through the shared outbox.
    /// </summary>
    public static IServiceCollection AddNotificationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddIntegrationEventPublishing(configuration, environment);
        services.AddScoped<NotificationRecipientResolver>();
        services.AddScoped<INotificationService, PlatformNotificationRequestService>();
        return services;
    }

    /// <summary>Platform-owned per-user inbox and process-local SSE delivery endpoint.</summary>
    public static IServiceCollection AddPlatformNotificationInfrastructure(
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

    /// <summary>
    /// The valuation-request write path only: the Valuation context, its per-producer outbox
    /// publisher (D5), the Case Study PO-number lookup it reads through, and the request service.
    /// Case Study registers this rather than the full set because
    /// <see cref="CaseStudyValuationDispatchService"/> creates a valuation request when a
    /// case-study form is submitted; process ownership moves in Phase 3.
    /// </summary>
    public static IServiceCollection AddValuationRequestInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddValuationPersistence(configuration, connectionString);
        services.AddScoped<IValuationEventPublisher, ValuationOutboxPublisher>();
        services.AddScoped<IPropertyPoNumberLookup, CaseStudyPropertyPoNumberLookup>();
        services.AddScoped<IValuationRequestService, ValuationRequestService>();
        return services;
    }

    /// <summary>Everything the Valuation host serves, including evaluator recalls.</summary>
    public static IServiceCollection AddValuationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddValuationRequestInfrastructure(configuration, connectionString);
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
