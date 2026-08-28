using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure;

/// <summary>
/// Context-local registration for the Valuation bounded context (A8). Everything the
/// Valuation host serves, including evaluator recalls. The shared persistence/HTTP
/// plumbing still comes from the global Infrastructure extensions.
/// </summary>
public static class ValuationDependencyInjection
{
    public static IServiceCollection AddValuationInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
 // A9: Case Study reads go through the owner HTTP API. No CaseStudyDbContext here, and
 // no compose depends_on case-study (case-study already depends_on valuation).
        services.AddRemoteCaseStudy(configuration);
        services.AddRemotePlatformCatalogs(configuration);
        services.AddRemoteAttachmentLookup(configuration);
        services.AddRemoteAuditLogAppend(configuration);
 // The valuation-request write path: context, per-producer outbox publisher (D5),
 // HTTP PO-number lookup, and the request service.
        services.AddValuationPersistence(configuration, connectionString);
        services.AddScoped<IValuationEventPublisher, ValuationOutboxPublisher>();
        services.AddScoped<IPropertyPoNumberLookup, RemotePropertyPoNumberLookup>();
        services.AddScoped<IValuationRequestService, ValuationRequestService>();
        services.AddScoped<IEvaluatorRecallsService, EvaluatorRecallsService>();
        services.AddScoped<IComparablePropertyService, ComparablePropertyService>();
        services.AddScoped<PropertyComparableLinkService>();
        services.AddScoped<IPropertyComparableLinkService>(sp =>
            sp.GetRequiredService<PropertyComparableLinkService>());
        services.AddScoped<IPropertyComparableLinkLookup>(sp =>
            sp.GetRequiredService<PropertyComparableLinkService>());
        services.AddScoped<IValuationComparableSelectionService, ValuationComparableSelectionService>();
        services.AddScoped<IValuationApproachSettingsService, ValuationApproachSettingsService>();
        services.AddScoped<IValuationCostApproachService, ValuationCostApproachService>();
        services.AddScoped<IValuationReconciliationService, ValuationReconciliationService>();
        services.AddScoped<IValuationIssuanceGateService, ValuationIssuanceGateService>();
        services.AddScoped<IValuationReportDocumentService, ValuationReportDocumentService>();
        // ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع.
        services.AddScoped<IValuationReportIssuanceService, ValuationReportIssuanceService>();
        services.AddScoped<IValuationReportFieldInjectionService, ValuationReportFieldInjectionService>();
        services.AddScoped<IPriorValuationBankFeeder, PriorValuationBankFeeder>();
        return services;
    }
 /// <summary>Valuation write context, including its own outbox rows. Prefers a dedicated
 /// Valuation connection string. A8 physical move: lives beside <see cref="ValuationDbContext"/>.</summary>
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

}
