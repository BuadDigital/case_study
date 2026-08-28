using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Financial.Infrastructure;

/// <summary>
/// Context-local registration for the Financial bounded context (A8): inspector fees,
/// party billing statements, Enfaz billing, fee pricing, charges, and financial reports.
/// The shared persistence/HTTP plumbing still comes from the global Infrastructure extensions.
/// </summary>
public static class FinancialDependencyInjection
{
    public static IServiceCollection AddFinancialInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString,
        IHostEnvironment environment)
    {
        services.AddFinancialPersistence(configuration, connectionString);
        // Case Study reads/writes go through /api/case-study-dispatch. Do not
        // AddCaseStudyPersistence here (compose cycle: Case Study already depends_on financial).
        // AddRemoteCaseStudy also wires the upstream HTTP options, so the private
        // AddUpstreamHttp call that lived in the global body is redundant here.
        services.AddRemoteCaseStudy(configuration);
        services.AddHttpClient<ICaseStudyCommands, HttpCaseStudyCommands>();
        services.AddRemoteIdentityDirectory(configuration);
        services.AddRemoteAttachmentLookup(configuration);
        services.AddHttpClient<IKeyEntitlementLookup, HttpKeyEntitlementLookup>();
 // E6: كانت إشعارات المضيف المالي NullNotificationService («بقايا حتى يوجد
 // إيفاد») — صار له صندوق صادر حقيقي على نمط Operations/Failures، فتذكيرات
 // مهلة التفاوض وإشعارات الأتعاب القائمة تصل فعلاً.
        services.AddMessagingPersistence(configuration, connectionString);
        services.AddNotificationInfrastructure(configuration, environment);
        services.AddHttpClient<IOperationsTaskService, HttpOperationsTaskService>();
        services.AddInspectorFeeCollaborators();
        services.AddHostedService<BillingNegotiationDeadlineHostedService>();
        services.AddScoped<ICourtVisitFeeChargeService, CourtVisitFeeChargeService>();
        services.AddScoped<IKeyReceiptFeeChargeService, KeyReceiptFeeChargeService>();
        services.AddScoped<IPoEnfazInvoiceLookup, PoEnfazInvoiceLookup>();
        services.AddScoped<IPoEnfazBillingService, PoEnfazBillingService>();
        services.AddScoped<IPartyBillingStatementService, PartyBillingStatementService>();
        services.AddHostedService<PartyBillingMonthVendorHostedService>();
        services.AddHostedService<InspectorFeeLedgerMaintenanceHostedService>();
        services.AddScoped<IFinancialReportService, FinancialReportService>();
        services.AddScoped<IPartyFeePricingService, PartyFeePricingService>();
        services.AddScoped<IIncentiveSuspensionService, IncentiveSuspensionService>();
        services.AddScoped<IDiscountFlagService, DiscountFlagService>();
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
 /// <summary>Financial write context. Prefers a dedicated Financial connection string.
 /// A8 physical move: lives beside <see cref="FinancialDbContext"/> in the context library.</summary>
    public static IServiceCollection AddFinancialPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        var financialConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.Financial,
            connectionString);
        return services.AddBoundedContextPersistence<FinancialDbContext>(
            configuration,
            financialConnection);
    }

}
