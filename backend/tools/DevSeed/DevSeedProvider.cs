using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

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
        return services.BuildServiceProvider();
    }
}
