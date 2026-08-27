using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure;

/// <summary>
/// Context-local registration for the Failures bounded context (A8). The shared
/// persistence/HTTP plumbing still comes from the global Infrastructure extensions.
/// </summary>
public static class FailuresDependencyInjection
{
    public static IServiceCollection AddFailuresInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        services.AddFailuresPersistence(configuration, connectionString);
 // A9: Case Study reads and workflow/deed/timeline side effects go through the owner
 // HTTP API. No CaseStudyDbContext here, and no compose depends_on case-study
 // (case-study already depends_on failures).
        services.AddRemoteCaseStudy(configuration);
        services.AddHttpClient<ICaseStudyFailureCommands, HttpCaseStudyFailureCommands>();
        services.AddRemoteIdentityDirectory(configuration);
 // Pure-host outbox for platform notification requests (A6 — no ApplicationDbContext).
        services.AddMessagingPersistence(configuration, connectionString);
        services.AddNotificationInfrastructure(configuration, environment);
        services.AddScoped<IFailureLookup, FailureLookup>();
        services.AddScoped<IFailureService, FailureService>();
        services.AddScoped<IFailureTypesCatalogService, FailureTypesCatalogService>();
        return services;
    }
 /// <summary>Failures write context. Prefers a dedicated Failures connection string.
 /// A8 physical move: lives beside <see cref="FailuresDbContext"/> in the context library.</summary>
    public static IServiceCollection AddFailuresPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var failuresConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.Failures,
            connectionString);
        return services.AddBoundedContextPersistence<FailuresDbContext>(
            configuration,
            failuresConnection);
    }

}
