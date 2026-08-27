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

 // A10: the legacy god context is archived (git tag a10-legacy-stream-final carries its
 // final stream). Owner contexts are the only persistence; shared model mappings and the
 // audit/messaging plumbing below are all that remain here.

 // A8 physical move: AddAttachmentsPersistence lives in AttachmentsDependencyInjection
 // (contexts/attachments) beside its DbContext; the generic pool helper below is public
 // so per-context registrations can move with their contexts.

 // A8 physical move: AddPlatformPersistence lives in PlatformDependencyInjection
 // (contexts/platform) beside its DbContext.

 // A8 physical move: AddValuationPersistence lives in ValuationDependencyInjection
 // (contexts/valuation) beside its DbContext.

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

 // A8 physical move: AddIdentityPersistence and AddIdentityStores live in
 // IdentityDependencyInjection (contexts/identity) beside their DbContext.

 // A8 physical move: AddFailuresPersistence lives in FailuresDependencyInjection
 // (contexts/failures) beside its DbContext.

 // A8 physical move: AddOperationsPersistence lives in OperationsDependencyInjection
 // (contexts/operations) beside its DbContext.

 // A8 physical move: AddFinancialPersistence lives in FinancialDependencyInjection
 // (contexts/financial) beside its DbContext.

 // A8 physical move: AddCaseStudyPersistence lives in CaseStudyDependencyInjection
 // (contexts/case-study) beside its DbContext.

    // AddIdentityApplicationServices and AddIdentityInfrastructure moved to
    // RealEstateEval.Identity.Infrastructure (A8).

 // A8 physical move: AddIdentityStores lives in IdentityDependencyInjection
 // (contexts/identity) beside the Identity context and stores.

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

 // A8: AddIdentitySeedStores lives in the DevSeed leaf (DevSeedProvider) — it wires
 // Identity + Platform persistence for the throwaway seed graph only.

 // A8: CreateIdentityMaintenanceProvider moved to the RealEstateEval.DevSeed leaf project
 // (tools/DevSeed) beside DataSeeder, so context registrations can move with their contexts.

 // AddBlobStorage folded into AddAttachmentsInfrastructure (RealEstateEval.Attachments.Infrastructure, A8).

    // AddInspectorFeeCollaborators moved to RealEstateEval.Financial.Infrastructure (A8).

    // AddCaseStudyInfrastructure, AddCaseStudyCoreInfrastructure,
    // AddCaseStudyAuxiliaryInfrastructure, and AddWorkflowTaskCollaborators moved to
    // RealEstateEval.CaseStudy.Infrastructure (A8).

    // AddFailuresInfrastructure moved to RealEstateEval.Failures.Infrastructure (A8).

 // AddAttachmentsInfrastructure moved to RealEstateEval.Attachments.Infrastructure (A8).

    // A8: the AddRemote* owner-to-owner HTTP client registrations moved to
    // RemoteClientRegistration in RealEstateEval.Shared.RemoteClients (same namespace).
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
 // Phase 5: every calling host registers MessagingDbContext (no legacy fallback).
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
