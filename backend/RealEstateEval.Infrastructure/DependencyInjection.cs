using Microsoft.AspNetCore.Authentication;
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
        IConfiguration configuration,
        IHostEnvironment? environment = null)
    {
        services.AddOptions<DatabaseOptions>()
            .Bind(configuration.GetSection(DatabaseOptions.SectionName))
            .Validate(
                o => environment is null
                    || environment.IsDevelopment()
                    || o.UnpaginatedListCap > 0,
                "Database:UnpaginatedListCap must be greater than zero outside Development.")
            .ValidateOnStart();
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IAuditLogWriter, AuditLogWriter>();
        services.AddRedisCaching(configuration);
        return services;
    }

 // Phase 5: AddPersistence / AddLegacyApplicationPersistence removed — no runtime
 // composition registers ApplicationDbContext any more. The class survives only for
 // the frozen legacy migration stream (DbMigrate, design-time factory, guardrails).

 // A8 physical move: AddAttachmentsPersistence lives in AttachmentsDependencyInjection
 // (contexts/attachments) beside its DbContext; the generic pool helper below is public
 // so per-context registrations can move with their contexts.

 /// <summary>Platform catalog write context.</summary>
    public static IServiceCollection AddPlatformPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        return services.AddBoundedContextPersistence<PlatformDbContext>(configuration, connectionString);
    }

 /// <summary>Valuation write context, including its own outbox rows. Prefers a dedicated Valuation connection string.</summary>
    public static IServiceCollection AddValuationPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var valuationConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.Valuation,
            connectionString);
        return services.AddBoundedContextPersistence<ValuationDbContext>(
            configuration,
            valuationConnection);
    }

 /// <summary>
 /// Registers one bounded-context pool. Phase 1 used one physical database; Phase 4
 /// may point an extracted context at a dedicated database via
 /// <see cref="BoundedContextConnections"/>.
 /// </summary>
    public static IServiceCollection AddBoundedContextPersistence<TContext>(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
        where TContext : DbContext
    {
        var resolvedConnection = BoundedContextConnections.ForContext<TContext>(
            configuration,
            connectionString);
        var dbOptions = configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
            ?? new DatabaseOptions();
        var pooledConnectionString = NpgsqlConfiguration.EnhanceConnectionString(
            resolvedConnection,
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
        // A8: startup migration loops enumerate registered streams via these markers instead
        // of the catalog naming concrete context types.
        services.AddSingleton(new BoundedContextStreamRegistration(typeof(TContext)));

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

 // A8 physical move: AddFailuresPersistence lives in FailuresDependencyInjection
 // (contexts/failures) beside its DbContext.

 // A8 physical move: AddOperationsPersistence lives in OperationsDependencyInjection
 // (contexts/operations) beside its DbContext.

 // A8 physical move: AddFinancialPersistence lives in FinancialDependencyInjection
 // (contexts/financial) beside its DbContext.

 /// <summary>Case Study write context. Prefers a dedicated Case Study connection string.</summary>
    public static IServiceCollection AddCaseStudyPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var caseStudyConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.CaseStudy,
            connectionString);
        services.AddBoundedContextPersistence<CaseStudyDbContext>(
            configuration,
            caseStudyConnection);
        services.AddScoped<ICaseStudyRepository>(sp => sp.GetRequiredService<CaseStudyDbContext>());
        return services;
    }

    // AddIdentityApplicationServices and AddIdentityInfrastructure moved to
    // RealEstateEval.Identity.Infrastructure (A8).

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

        // AddIdentity() makes the Identity application cookie the default
        // authenticate/challenge scheme, which sends API callers to /Account/Login —
        // on the Identity host this 401'd every [Authorize] endpoint (incl.
        // /api/permissions, breaking the shell role chip). The APIs are JWT-only,
        // so re-assert bearer; this Configure runs after Identity's and wins.
        services.Configure<AuthenticationOptions>(options =>
        {
            options.DefaultAuthenticateScheme = "Bearer";
            options.DefaultChallengeScheme = "Bearer";
        });

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
        services.AddPlatformPersistence(configuration, connectionString);
        services.AddIdentityStores();
        return services;
    }

 // A8: CreateIdentityMaintenanceProvider moved to the RealEstateEval.DevSeed leaf project
 // (tools/DevSeed) beside DataSeeder, so context registrations can move with their contexts.

 // AddBlobStorage folded into AddAttachmentsInfrastructure (RealEstateEval.Attachments.Infrastructure, A8).

    // AddInspectorFeeCollaborators moved to RealEstateEval.Financial.Infrastructure (A8).

    // AddCaseStudyInfrastructure, AddCaseStudyCoreInfrastructure,
    // AddCaseStudyAuxiliaryInfrastructure, and AddWorkflowTaskCollaborators moved to
    // RealEstateEval.CaseStudy.Infrastructure (A8).

    // AddFailuresInfrastructure moved to RealEstateEval.Failures.Infrastructure (A8).

 // AddAttachmentsInfrastructure moved to RealEstateEval.Attachments.Infrastructure (A8).

    /// <summary>
    /// Attachment existence and report lookups via the Attachments HTTP API.
    /// Forwards the caller's Authorization header. Do not combine with
    /// <see cref="AddAttachmentsPersistence"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemoteAttachmentLookup(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IAttachmentLookup, HttpAttachmentLookup>();
        return services;
    }

    /// <summary>
    /// Print dictionary and organization settings via the Platform HTTP API.
    /// Do not combine with <see cref="AddPlatformPersistence"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemotePlatformCatalogs(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IAttachmentPrintDictionaryService, HttpAttachmentPrintDictionaryService>();
        services.AddHttpClient<IValuationListsService, HttpValuationListsService>();
        services.AddHttpClient<IOrganizationSettingsService, HttpOrganizationSettingsService>();
        return services;
    }

    /// <summary>
    /// Create/open valuation requests via the Valuation HTTP API (Case Study dispatch).
    /// Do not combine with <see cref="AddValuationRequestInfrastructure"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemoteValuationRequests(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IValuationRequestService, HttpValuationRequestService>();
        services.AddHttpClient<IPropertyComparableLinkLookup, HttpPropertyComparableLinkLookup>();
        return services;
    }

    /// <summary>
    /// Inspector fees, billing, Enfaz, pricing, and charges via the Financial HTTP API.
    /// Do not combine with <see cref="AddFinancialPersistence"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemoteFinancial(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IInspectorFeeService, HttpInspectorFeeService>();
        services.AddHttpClient<IPartyBillingStatementService, HttpPartyBillingStatementService>();
        services.AddHttpClient<IPoEnfazBillingService, HttpPoEnfazBillingService>();
        services.AddHttpClient<IPartyFeePricingService, HttpPartyFeePricingService>();
        services.AddHttpClient<ICourtVisitFeeChargeService, HttpCourtVisitFeeChargeService>();
        services.AddHttpClient<IKeyReceiptFeeChargeService, HttpKeyReceiptFeeChargeService>();
        services.AddHttpClient<IPoEnfazInvoiceLookup, HttpPoEnfazInvoiceLookup>();
        return services;
    }

    /// <summary>
    /// Failure commands and gates via the Failures HTTP API. Do not combine with
    /// <see cref="AddFailuresPersistence"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemoteFailures(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IFailureService, HttpFailureService>();
        services.AddHttpClient<IFailureLookup, HttpFailureLookup>();
        return services;
    }

    /// <summary>
    /// Case Study lookups via the Case Study HTTP API. Do not combine with
    /// <see cref="AddCaseStudyPersistence"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemoteCaseStudy(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<ICaseStudyLookup, HttpCaseStudyLookup>();
        services.AddHttpClient<IWorkflowAssigneeLookup, HttpWorkflowAssigneeLookup>();
        return services;
    }

    /// <summary>
    /// Operations tasks, keys, envelopes, and survey offices via the Operations HTTP API.
    /// Do not combine with <see cref="AddOperationsPersistence"/> on the same host.
    /// </summary>
    public static IServiceCollection AddRemoteOperations(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IOperationsTaskService, HttpOperationsTaskService>();
        services.AddHttpClient<IKeyEntitlementLookup, HttpKeyEntitlementLookup>();
        services.AddHttpClient<IPropertyKeyGateResolver, HttpPropertyKeyGateResolver>();
        services.AddHttpClient<IPropertyKeysService, HttpPropertyKeysService>();
        services.AddHttpClient<ISurveyOfficesService, HttpSurveyOfficesService>();
        return services;
    }

    /// <summary>
    /// Display-name lookup via the Identity HTTP API.
    /// </summary>
    public static IServiceCollection AddRemoteAuditLogAppend(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IAuditLogAppend, HttpAuditLogAppend>();
        return services;
    }

    public static IServiceCollection AddRemoteIdentityDirectory(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IIdentityDirectory, HttpIdentityDirectory>();
        services.AddScoped<IUserLabelLookup>(sp => sp.GetRequiredService<IIdentityDirectory>());
        return services;
    }

    public static IServiceCollection AddRemoteWorkflowAssignees(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddUpstreamHttp(configuration);
        services.AddHttpClient<IWorkflowAssigneeLookup, HttpWorkflowAssigneeLookup>();
        return services;
    }

    public static IServiceCollection AddRemoteUserLabelLookup(
        this IServiceCollection services,
        IConfiguration configuration) =>
        services.AddRemoteIdentityDirectory(configuration);

    private static IServiceCollection AddUpstreamHttp(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddOptions<UpstreamServicesOptions>()
            .Bind(configuration.GetSection(UpstreamServicesOptions.SectionName));
        return services;
    }

    // AddFinancialInfrastructure moved to RealEstateEval.Financial.Infrastructure (A8);
    // the dead parameterless overload was dropped.

    // AddOperationsInfrastructure and AddOperationsTaskCollaborators moved to
    // RealEstateEval.Operations.Infrastructure (A8); the dead parameterless
    // AddOperationsInfrastructure overload was dropped.

    // AddPlatformInfrastructure moved to RealEstateEval.Platform.Infrastructure (A8).

 /// <summary>
 /// Messaging write context. Requires a dedicated Messaging connection string.
 /// Valuation keeps its own outbox on the valuation database (D5).
 /// </summary>
    public static IServiceCollection AddMessagingPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var messagingConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.Messaging);
        return services.AddBoundedContextPersistence<MessagingDbContext>(
            configuration,
            messagingConnection);
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
 // Phase 5: every calling host registers MessagingDbContext — the legacy
 // ApplicationDbContext fallback is gone.
        services.AddScoped<IIntegrationEventPublisher, MessagingOutboxPublisher>();
        services.AddScoped<NotificationRecipientResolver>();
        services.AddScoped<INotificationRecipientResolver>(sp =>
            sp.GetRequiredService<NotificationRecipientResolver>());
        services.AddScoped<INotificationService, PlatformNotificationRequestService>();
        return services;
    }

    // AddPlatformNotificationInfrastructure moved to RealEstateEval.Platform.Infrastructure (A8).

 // AddValuationRequestInfrastructure folded into AddValuationInfrastructure (RealEstateEval.Valuation.Infrastructure, A8).

 // AddValuationInfrastructure moved to RealEstateEval.Valuation.Infrastructure (A8).

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
 // Phase 5: publishing hosts register MessagingDbContext (Valuation uses its own
 // ValuationOutboxPublisher via AddValuationRequestInfrastructure).
        services.AddScoped<IIntegrationEventPublisher, MessagingOutboxPublisher>();
        return services;
    }

 /// <summary>
 /// Deduplication store for services that consume integration events. Consuming hosts
 /// register <see cref="MessagingDbContext"/> (Phase 5 — no legacy fallback).
 /// </summary>
    public static IServiceCollection AddIntegrationEventInbox(this IServiceCollection services)
    {
        services.AddScoped<IIntegrationEventInbox, IntegrationEventInbox>();
        return services;
    }

 /// <summary>
 /// Polls <c>OutboxMessages</c> and publishes to RabbitMQ. Register once per physical
 /// outbox database (Case Study drains the dedicated messaging database; Valuation drains
 /// its dedicated database after the Phase 4 cutover).
 /// </summary>
    public static IServiceCollection AddOutboxDispatcher(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        services.AddValidatedRabbitMqOptions(configuration, environment);
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

 /// <summary>
 /// Event-owning hosts (case-study / valuation outbox drain, platform consumers) fail fast in Production
 /// when the broker is disabled. Set <c>RabbitMQ:RequireEnabled=false</c> only in tests.
 /// </summary>
    public static IHostApplicationBuilder RequireEventBrokerInProduction(
        this IHostApplicationBuilder builder)
    {
        if (!builder.Environment.IsProduction())
            return builder;

        var requireEnabled = builder.Configuration.GetValue("RabbitMQ:RequireEnabled", true);
        var enabled = builder.Configuration.GetValue("RabbitMQ:Enabled", false);
        if (requireEnabled && !enabled)
        {
            throw new InvalidOperationException(
                "RabbitMQ must be enabled in Production for event-owning services. "
                + "Set RabbitMQ:Enabled=true or disable RabbitMQ:RequireEnabled only in tests.");
        }

        return builder;
    }

    // AddValuationIntegrationHandlers moved to RealEstateEval.CaseStudy.Infrastructure (A8).

    // AddNotificationIntegrationHandlers moved to RealEstateEval.Platform.Infrastructure (A8).
}
