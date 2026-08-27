using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Operations.Infrastructure;
using RealEstateEval.Financial.Infrastructure;
using RealEstateEval.CaseStudy.Infrastructure;
using RealEstateEval.Valuation.Infrastructure;
using RealEstateEval.Failures.Infrastructure;
using RealEstateEval.Identity.Infrastructure;
using RealEstateEval.Platform.Infrastructure;
using RealEstateEval.Attachments.Infrastructure;

namespace RealEstateEval.Infrastructure;

/// <summary>
/// Short-lived DI graph for Development identity seed/reset. Case Study request paths stay
/// claims-only; only this throwaway provider opens Identity stores and registration writes.
/// A8: lives in the DevSeed leaf beside <see cref="Data.DataSeeder"/> so per-context
/// persistence registrations can move with their contexts.
/// </summary>
public static class DevSeedProvider
{
    public static ServiceProvider CreateIdentityMaintenanceProvider(
        IConfiguration configuration,
        string connectionString)
    {
 // Phase 5: the seed graph is bounded-context only — the legacy god context is never
 // registered here. DataSeeder.SeedAsync needs all six owner contexts; each resolves
 // its own connection string, so seeding requires them configured.
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(configuration);
        services.AddHostSharedInfrastructure(configuration);
        services.AddIdentitySeedStores(configuration, connectionString);
        services.AddOperationsPersistence(configuration, connectionString);
        services.AddFinancialPersistence(configuration, connectionString);
        services.AddCaseStudyPersistence(configuration, connectionString);
        services.AddValuationPersistence(configuration, connectionString);
        services.AddFailuresPersistence(configuration, connectionString);
 // Seed-time audit entries land on the Platform database, as they did when the
 // registration service could take PlatformDbContext directly (A8 unwind).
        services.AddScoped<RealEstateEval.Application.Abstractions.IAuditLogAppend,
            RealEstateEval.Platform.Infrastructure.Services.PlatformAuditLogAppend>();
        return services.BuildServiceProvider();
    }
 /// <summary>
 /// Development-only Identity stores for demo seeding. Does not register auth write services
 /// or database-backed permission resolution — request paths still use claims.
 /// A8: lives here because it wires Identity + Platform persistence together, which no
 /// single context library may do.
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

 /// <summary>
 /// Throwaway DI graph for the Development system reset: every owner context plus the
 /// identity registration/session services (remaining-work note: without
 /// IAuthSessionService the user purge fails). Request paths never see this graph.
 /// </summary>
    public static ServiceProvider CreateResetProvider(
        IConfiguration configuration,
        string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(configuration);
        services.AddHostSharedInfrastructure(configuration);
        services.AddIdentitySeedStores(configuration, connectionString);
        services.AddOperationsPersistence(configuration, connectionString);
        services.AddFinancialPersistence(configuration, connectionString);
        services.AddCaseStudyPersistence(configuration, connectionString);
        services.AddValuationPersistence(configuration, connectionString);
        services.AddFailuresPersistence(configuration, connectionString);
        services.AddAttachmentsPersistence(configuration, connectionString);
        services.AddMessagingPersistence(configuration, connectionString);
 // The registration/session bundle (IUserRegistrationService + IAuthSessionService and
 // their permission/JWT dependencies) — the user purge revokes sessions as it deletes.
        services.AddIdentityApplicationServices();
 // Reset/registration audit lands on the Platform database like the old god-context reset.
        services.AddScoped<Application.Abstractions.IAuditLogAppend,
            Platform.Infrastructure.Services.PlatformAuditLogAppend>();
        return services.BuildServiceProvider();
    }
}
