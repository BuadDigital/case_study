using RealEstateEval.Operations.Application.Rules;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Infrastructure.Services;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;

namespace RealEstateEval.Operations.Infrastructure;

/// <summary>
/// Context-local registration for the Operations bounded context (A8): survey offices,
/// property keys, key envelopes, and the operations-task collaborators. The shared
/// persistence/HTTP plumbing still comes from the global Infrastructure extensions.
/// </summary>
public static class OperationsDependencyInjection
{
    public static IServiceCollection AddOperationsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        services.AddOperationsPersistence(configuration, connectionString);
        services.AddRemoteIdentityDirectory(configuration);
        services.AddRemoteAttachmentLookup(configuration);
        services.AddRemoteFailures(configuration);
        services.AddRemoteCaseStudy(configuration);
        // Pure-host outbox for platform notification requests (mirrors AddFailuresInfrastructure) —
        // KeyEnvelopesService / PropertyAccessHoldService notify the case specialist and need
        // INotificationService + NotificationRecipientResolver to be resolvable here.
        services.AddMessagingPersistence(configuration, connectionString);
        services.AddNotificationInfrastructure(configuration, environment);
        services.AddScoped<IKeyEntitlementLookup, KeyEnvelopeEntitlementLookup>();
        services.AddScoped<ISurveyOfficesService, SurveyOfficesService>();
        services.AddScoped<IPropertyKeysService, PropertyKeysService>();
        services.AddScoped<IPropertyKeyGateResolver, PropertyKeyGateResolver>();
        services.AddScoped<IPropertyAccessHoldService, PropertyAccessHoldService>();
        services.AddScoped<IKeyEnvelopePeopleResolver, KeyEnvelopePeopleResolver>();
        services.AddScoped<IKeyEnvelopesService, KeyEnvelopesService>();
        services.AddOperationsTaskCollaborators();
        // After collaborators so HTTP court-visit charges win over the EF helper.
        services.AddRemoteFinancial(configuration);
        return services;
    }

    /// <summary>Operations-task façade + query / command / reminder collaborators.</summary>
    public static IServiceCollection AddOperationsTaskCollaborators(this IServiceCollection services)
    {
        services.AddScoped<OperationsTaskNotifier>();
        services.AddScoped<OperationsTaskVisitFeeHelper>();
        services.AddScoped<IOperationsTaskQuery, OperationsTaskQueryService>();
        services.AddScoped<IOperationsTaskCommands, OperationsTaskCommands>();
        services.AddScoped<IOperationsTaskService, OperationsTaskService>();
        services.AddHostedService<OperationsTaskReminderHostedService>();
        services.AddHostedService<PropertyKeysProjectionHostedService>();
        return services;
    }
 /// <summary>Operations write context. Prefers a dedicated Operations connection string.
 /// A8 physical move: lives beside <see cref="OperationsDbContext"/> in the context library.</summary>
    public static IServiceCollection AddOperationsPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var operationsConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.Operations,
            connectionString);
        return services.AddBoundedContextPersistence<OperationsDbContext>(
            configuration,
            operationsConnection);
    }

}
