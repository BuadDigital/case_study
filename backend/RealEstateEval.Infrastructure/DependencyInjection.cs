using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
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
 /// <summary>
 /// Host-local cross-cutting bits that do not open the legacy god context: database options,
 /// clock, audit builder, Redis cache. Pure extracted APIs call this instead of
 /// <see cref="AddPersistence"/> (A6).
 /// </summary>
    public static IServiceCollection AddHostSharedInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IAuditLogWriter, AuditLogWriter>();
        services.AddRedisCaching(configuration);
        return services;
    }

 /// <summary>
 /// Residual <see cref="ApplicationDbContext"/> pool for hosts that still write or read through
 /// the transitional god context (Case Study residual writers, dual fee paths, outbox drain).
 /// Registers <see cref="IUserLabelLookup"/> because label resolution still loads Identity tables
 /// via App. Prefer owned contexts; do not call this from pure extracted hosts.
 /// </summary>
    public static IServiceCollection AddLegacyApplicationPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var dbOptions = configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();
        var pooledConnectionString = NpgsqlConfiguration.EnhanceConnectionString(connectionString,configuration);

        services.AddDbContextPool<ApplicationDbContext>(options =>
            options.UseNpgsql(pooledConnectionString, npgsql =>
            {
                npgsql.EnableRetryOnFailure(maxRetryCount: 3);
                npgsql.CommandTimeout(dbOptions.CommandTimeoutSeconds);
            }));

 // Factory: dual ctors on UserLabelLookup are ambiguous when both Identity and App
 // pools are registered (case-study). Prefer IdentityDbContext (D10 / A6).
        services.TryAddScoped<IUserLabelLookup>(sp =>
        {
            if (sp.GetService<IdentityDbContext>() is { } identity)
                return new UserLabelLookup(identity);
            return new UserLabelLookup(sp.GetRequiredService<ApplicationDbContext>());
        });
        return services;
    }

 /// <summary>
 /// Shared host bits + residual god-context pool. Use only while a host still needs
 /// <see cref="ApplicationDbContext"/>. Extracted pure APIs should call
 /// <see cref="AddHostSharedInfrastructure"/> + their owned context registration instead (A6).
 /// </summary>
    public static IServiceCollection AddPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddHostSharedInfrastructure(configuration);
        services.AddLegacyApplicationPersistence(configuration, connectionString);
        return services;
    }

 /// <summary>Attachments write context.</summary>
    public static IServiceCollection AddAttachmentsPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
 // Block body (not expression-bodied): architecture fan-out scans method braces.
        return services.AddBoundedContextPersistence<AttachmentsDbContext>(configuration, connectionString);
    }

 /// <summary>Platform catalog write context.</summary>
    public static IServiceCollection AddPlatformPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<PlatformDbContext>(configuration, connectionString);
    }

 /// <summary>Valuation write context, including its own outbox rows.</summary>
    public static IServiceCollection AddValuationPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<ValuationDbContext>(configuration, connectionString);
    }

 /// <summary>
 /// Registers one bounded-context pool against the same physical database as the legacy
 /// context. separates models and migration streams, not connections: only the
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

 /// <summary>Identity write context.</summary>
    public static IServiceCollection AddIdentityPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<IdentityDbContext>(configuration, connectionString);
    }

 /// <summary>Failures write context.</summary>
    public static IServiceCollection AddFailuresPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<FailuresDbContext>(configuration, connectionString);
    }

 /// <summary>Operations write context.</summary>
    public static IServiceCollection AddOperationsPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<OperationsDbContext>(configuration, connectionString);
    }

 /// <summary>Financial write context.</summary>
    public static IServiceCollection AddFinancialPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<FinancialDbContext>(configuration, connectionString);
    }

 /// <summary>Case Study write context.</summary>
    public static IServiceCollection AddCaseStudyPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<CaseStudyDbContext>(configuration, connectionString);
    }

 /// <summary>
 /// ASP.NET Identity stores and Identity write/permission services. Callers must register
 /// <see cref="IdentityDbContext"/> first (via <see cref="AddIdentityPersistence"/> or a
 /// test InMemory registration).
 /// </summary>
    public static IServiceCollection AddIdentityApplicationServices(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IAuditLogWriter, AuditLogWriter>();
 // No IUserLabelLookup: Identity uses IdentityDbContext stores; label resolution that still
 // needs residual App lives only on hosts that call AddLegacyApplicationPersistence.
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
 /// opening Identity stores.
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

 /// <summary>
 /// Short-lived DI graph for Development identity seed/reset. Case Study request paths stay
 /// claims-only; only this throwaway provider opens Identity stores and registration writes.
 /// </summary>
    public static ServiceProvider CreateIdentityMaintenanceProvider(
        IConfiguration configuration,
        string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(configuration);
        services.AddPersistence(configuration, connectionString);
        services.AddIdentitySeedStores(configuration, connectionString);
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
        return services.BuildServiceProvider();
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
        services.AddScoped<IWorkOrderLoader, WorkOrderLoader>();
        services.AddScoped<IWorkOrderQuery, WorkOrderQueryService>();
        services.AddScoped<IWorkOrderPropertyCommands, WorkOrderPropertyCommands>();
        services.AddScoped<IWorkOrderService, WorkOrderService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IBuildingInventoryService, BuildingInventoryService>();
        services.AddScoped<IPropertyGroupService, PropertyGroupService>();
        services.AddWorkflowTaskCollaborators();
        services.AddScoped<IWorkOrderVisibilityFilter, WorkOrderVisibilityFilter>();
        services.AddScoped<ICaseStudyFormService, CaseStudyFormService>();
        services.AddScoped<ICaseStudyValuationDispatchService, CaseStudyValuationDispatchService>();
        services.AddScoped<IPartyTaskSubmissionService, PartyTaskSubmissionService>();
        services.AddScoped<IFieldInspectionWorkspaceService, FieldInspectionWorkspaceService>();
        services.AddInspectorFeeCollaborators();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IIncentiveSuspensionService, IncentiveSuspensionService>();
        services.AddScoped<IDiscountFlagService, DiscountFlagService>();
        services.AddScoped<IPoEnfazBillingService, PoEnfazBillingService>();
        services.AddScoped<IPartyBillingStatementService, PartyBillingStatementService>();
        services.AddScoped<IFieldInspectionAttachmentVerifier, FieldInspectionAttachmentVerifier>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        services.AddScoped<IWorkflowTaskShellPatcher, WorkflowTaskShellPatcher>();
        services.AddScoped<IFailureService, FailureService>();
        services.AddScoped<IPropertyKeyGateResolver, PropertyKeyGateResolver>();
        services.AddScoped<IPropertyAccessHoldService, PropertyAccessHoldService>();
        services.AddScoped<IKeyEnvelopePeopleResolver, KeyEnvelopePeopleResolver>();
        services.AddScoped<IKeyEnvelopesService, KeyEnvelopesService>();
        return services;
    }

 /// <summary>Inspector-fee façade + ledger/transition/summary collaborators.</summary>
    public static IServiceCollection AddInspectorFeeCollaborators(this IServiceCollection services)
    {
        services.AddScoped<IInspectorFeeLedgerResolver, InspectorFeeLedgerResolver>();
        services.AddScoped<IInspectorFeeLedgerWriter, InspectorFeeLedgerWriter>();
        services.AddScoped<IInspectorFeeTransitionApplier, InspectorFeeTransitionApplier>();
        services.AddScoped<IInspectorFeeSummaryQuery, InspectorFeeSummaryQuery>();
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        return services;
    }

 /// <summary>PO intake drafts, delegation letters, suspended-transaction reads.</summary>
    public static IServiceCollection AddCaseStudyAuxiliaryInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IPoIntakeDraftService, PoIntakeDraftService>();
        services.AddScoped<OperationsTaskNotifier>();
        services.AddScoped<OperationsTaskVisitFeeHelper>();
        services.AddScoped<IOperationsTaskQuery, OperationsTaskQueryService>();
        services.AddScoped<IOperationsTaskCommands, OperationsTaskCommands>();
        services.AddScoped<IOperationsTaskService, OperationsTaskService>();
        services.AddHostedService<OperationsTaskReminderHostedService>();
        services.AddHostedService<PartyBillingMonthVendorHostedService>();
        services.AddScoped<ISuspendedTransactionsService, SuspendedTransactionsService>();
        return services;
    }

    public static IServiceCollection AddCaseStudyInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
 // Hosts that call this must have registered AddCaseStudyPersistence /
 // AddFinancialPersistence (and failures/ops as needed) against the same connection.
        services.AddCaseStudyCoreInfrastructure();
        services.AddCaseStudyAuxiliaryInfrastructure();
        services.AddNotificationInfrastructure(configuration, environment);
        return services;
    }

 /// <summary>
 /// Development-only reset support for UserManager / seed. Hosts must already register
 /// <see cref="AddIdentityPersistence"/> (fee residual paths on Case Study / Failures).
 /// Does not re-register the Identity pool.
 /// </summary>
    public static IServiceCollection AddDevelopmentSystemMaintenance(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        if (!environment.IsDevelopment()) return services;

        services.AddIdentityStores();
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
        services.AddScoped<ISystemMaintenanceService, SystemMaintenanceService>();
        return services;
    }

    public static IServiceCollection AddFailuresInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        services.AddFailuresPersistence(configuration, connectionString);
 // Residual cross-boundary: WorkOrder/Workflow on Case Study; Identity labels/recipients.
        services.AddCaseStudyPersistence(configuration, connectionString);
        services.AddIdentityPersistence(configuration, connectionString);
 // Pure-host outbox for platform notification requests (A6 — no ApplicationDbContext).
        services.AddMessagingPersistence(configuration, connectionString);
        services.AddNotificationInfrastructure(configuration, environment);
        services.TryAddScoped<IUserLabelLookup>(sp =>
            new UserLabelLookup(sp.GetRequiredService<IdentityDbContext>()));
        services.AddScoped<IWorkflowTaskShellPatcher, WorkflowTaskShellPatcher>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        services.AddScoped<IFailureService, FailureService>();
        services.AddScoped<IFailureTypesCatalogService, FailureTypesCatalogService>();
        return services;
    }

 /// <summary>Workflow task façade + query / distribution / lifecycle collaborators.</summary>
    public static IServiceCollection AddWorkflowTaskCollaborators(this IServiceCollection services)
    {
        services.AddScoped<IWorkflowTaskVisibilityFilter, WorkflowTaskVisibilityFilter>();
        services.AddScoped<IWorkflowTaskQuery, WorkflowTaskQueryService>();
        services.AddScoped<IDashboardOpsMetricsQuery, DashboardOpsMetricsQueryService>();
        services.AddScoped<IWorkflowTaskSlotSynchronizer, WorkflowTaskSlotSynchronizer>();
        services.AddScoped<IWorkflowTaskDistributionCommands, WorkflowTaskDistributionCommands>();
        services.AddScoped<WorkflowTaskCascadeCleanup>();
        services.AddScoped<IWorkflowTaskLifecycleCommands, WorkflowTaskLifecycleCommands>();
        services.AddScoped<IWorkflowTaskService, WorkflowTaskService>();
        return services;
    }

    public static IServiceCollection AddAttachmentsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddAttachmentsPersistence(configuration, connectionString);
 // classification validates keys against the admin print dictionary.
        services.AddPlatformPersistence(configuration, connectionString);
        services.AddScoped<IAttachmentPrintDictionaryService, AttachmentPrintDictionaryService>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        return services;
    }

    public static IServiceCollection AddFinancialInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddFinancialPersistence(configuration, connectionString);
 // Report / discount / incentive residual reads.
        services.AddCaseStudyPersistence(configuration, connectionString);
        services.AddIdentityPersistence(configuration, connectionString);
        services.AddScoped<IFinancialReportService, FinancialReportService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IIncentiveSuspensionService, IncentiveSuspensionService>();
        services.AddScoped<IDiscountFlagService, DiscountFlagService>();
        return services;
    }

 /// <summary>Financial services when financial (+ residual CS/identity) persistence is already registered.</summary>
    public static IServiceCollection AddFinancialInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IFinancialReportService, FinancialReportService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IIncentiveSuspensionService, IncentiveSuspensionService>();
        services.AddScoped<IDiscountFlagService, DiscountFlagService>();
        return services;
    }

    public static IServiceCollection AddOperationsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        services.AddOperationsPersistence(configuration, connectionString);
 // Residual cross-boundary reads: property rows, fee charges, attachment checks, identity labels.
        services.AddFailuresPersistence(configuration, connectionString);
        services.AddCaseStudyPersistence(configuration, connectionString);
        services.AddFinancialPersistence(configuration, connectionString);
        services.AddIdentityPersistence(configuration, connectionString);
        services.AddAttachmentsPersistence(configuration, connectionString);
 // Pure-host outbox for platform notification requests (mirrors AddFailuresInfrastructure) —
 // KeyEnvelopesService / PropertyAccessHoldService notify the case specialist and need
 // INotificationService + NotificationRecipientResolver to be resolvable here.
        services.AddMessagingPersistence(configuration, connectionString);
        services.AddNotificationInfrastructure(configuration, environment);
        services.AddScoped<ISurveyOfficesService, SurveyOfficesService>();
        services.AddScoped<IPropertyKeysService, PropertyKeysService>();
        services.AddScoped<IPropertyKeyGateResolver, PropertyKeyGateResolver>();
        services.AddScoped<IPropertyAccessHoldService, PropertyAccessHoldService>();
        services.AddScoped<IKeyEnvelopePeopleResolver, KeyEnvelopePeopleResolver>();
        services.AddScoped<IKeyEnvelopesService, KeyEnvelopesService>();
        return services;
    }

 /// <summary>
 /// Operations services when the caller's host already registered
 /// <see cref="AddOperationsPersistence"/> (or InMemory tests).
 /// </summary>
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

 /// <summary>Messaging write context.</summary>
    public static IServiceCollection AddMessagingPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<MessagingDbContext>(configuration, connectionString);
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
        services.AddValidatedRabbitMqOptions(configuration, environment);
 // Prefer Messaging outbox when the host registered MessagingDbContext (pure A6 hosts).
 // Residual dual-write hosts keep ApplicationDbContext OutboxIntegrationEventPublisher.
        services.AddScoped<IIntegrationEventPublisher>(sp =>
        {
            if (sp.GetService<MessagingDbContext>() is { } messaging)
            {
                return new MessagingOutboxPublisher(
                    messaging,
                    sp.GetRequiredService<ILogger<MessagingOutboxPublisher>>());
            }

            return new OutboxIntegrationEventPublisher(
                sp.GetRequiredService<ApplicationDbContext>(),
                sp.GetRequiredService<ILogger<OutboxIntegrationEventPublisher>>());
        });
        services.AddScoped<NotificationRecipientResolver>();
        services.AddScoped<INotificationService>(sp =>
        {
            var events = sp.GetRequiredService<IIntegrationEventPublisher>();
            if (sp.GetService<MessagingDbContext>() is { } messaging)
                return new PlatformNotificationRequestService(messaging, events);
            return new PlatformNotificationRequestService(
                sp.GetRequiredService<ApplicationDbContext>(),
                events);
        });
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

 /// <summary>
 /// The valuation-request write path only: the Valuation context, its per-producer outbox
 /// publisher, the Case Study PO-number lookup it reads through, and the request service.
 /// Hosts must already register <see cref="AddCaseStudyPersistence"/> (or an InMemory
 /// <see cref="CaseStudyDbContext"/>) so <see cref="CaseStudyPropertyPoNumberLookup"/> can
 /// resolve PO numbers without opening the legacy god context.
 /// Case Study registers this rather than the full set because
 /// <see cref="CaseStudyValuationDispatchService"/> creates a valuation request when a
 /// case-study form is submitted; process ownership moves in.
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
 // Residual cross-boundary PO read for event payloads.
        services.AddCaseStudyPersistence(configuration, connectionString);
        services.AddPlatformPersistence(configuration, connectionString);
 // Report document + attachments gate read printable attachments.
        services.AddAttachmentsPersistence(configuration, connectionString);
        services.AddScoped<IAttachmentPrintDictionaryService, AttachmentPrintDictionaryService>();
        services.AddValuationRequestInfrastructure(configuration, connectionString);
        services.TryAddSingleton<IAuditLogWriter, AuditLogWriter>();
        services.AddScoped<IOrganizationSettingsService, OrganizationSettingsService>();
        services.AddScoped<IEvaluatorRecallsService, EvaluatorRecallsService>();
        services.AddScoped<IComparablePropertyService, ComparablePropertyService>();
        services.AddScoped<IValuationComparableSelectionService, ValuationComparableSelectionService>();
        services.AddScoped<IValuationApproachSettingsService, ValuationApproachSettingsService>();
        services.AddScoped<IInspectionLimitsService, InspectionLimitsService>();
        services.AddScoped<IValuationCostApproachService, ValuationCostApproachService>();
        services.AddScoped<IValuationReconciliationService, ValuationReconciliationService>();
        services.AddScoped<IValuationIssuanceGateService, ValuationIssuanceGateService>();
        services.AddScoped<IValuationReportDocumentService, ValuationReportDocumentService>();
        services.AddScoped<IValuationReportFieldInjectionService, ValuationReportFieldInjectionService>();
        services.AddScoped<IPriorValuationBankFeeder, PriorValuationBankFeeder>();
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
 /// Uses a factory so DI never has to pick between the dual public constructors
 /// (Messaging vs Application). Prefers <see cref="MessagingDbContext"/> when registered
 /// so Platform writes share the messaging unit of work; residual hosts use
 /// <see cref="ApplicationDbContext"/>.
 /// </summary>
    public static IServiceCollection AddIntegrationEventInbox(this IServiceCollection services)
    {
        services.AddScoped<IIntegrationEventInbox>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<IntegrationEventInbox>>();
            if (sp.GetService<MessagingDbContext>() is { } messaging)
                return new IntegrationEventInbox(messaging, logger);
            return new IntegrationEventInbox(
                sp.GetRequiredService<ApplicationDbContext>(),
                logger);
        });
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
 // Residual single host: Case Study drains via ApplicationDbContext against the shared
 // messaging.OutboxMessages table (E7 — rebind ContextType when multi-dispatcher lands).
        services.AddOptions<OutboxDispatcherOptions>();
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
