using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Infrastructure;

/// <summary>
/// Registrations for the owner-to-owner HTTP clients (A8: moved out of the global
/// Infrastructure assembly with the clients themselves; the namespace is unchanged so
/// host modules keep calling <c>services.AddRemote*</c> with no using churn).
/// </summary>
public static class RemoteClientRegistration
{
    /// <summary>
    /// Attachment existence and report lookups via the Attachments HTTP API.
    /// Forwards the caller's Authorization header. Do not combine with
    /// <c>AddAttachmentsPersistence</c> on the same host.
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
    /// Do not combine with <c>AddPlatformPersistence</c> on the same host.
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
    /// Do not combine with <c>AddValuationRequestInfrastructure</c> on the same host.
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
    /// Do not combine with <c>AddFinancialPersistence</c> on the same host.
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
    /// <c>AddFailuresPersistence</c> on the same host.
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
    /// <c>AddCaseStudyPersistence</c> on the same host.
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
    /// Do not combine with <c>AddOperationsPersistence</c> on the same host.
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

    private static IServiceCollection AddUpstreamHttp(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddOptions<UpstreamServicesOptions>()
            .Bind(configuration.GetSection(UpstreamServicesOptions.SectionName));
        services.TryAddSingleton<UpstreamServiceBearer>();
        services.TryAddEnumerable(
            ServiceDescriptor.Singleton<IHostedService, UpstreamServiceBearerWarmupHostedService>());
        return services;
    }
}
