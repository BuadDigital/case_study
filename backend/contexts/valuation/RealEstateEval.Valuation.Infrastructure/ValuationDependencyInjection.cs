// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D17  Registers IValuationIncomeApproachRepository and IValuationIncomeApproachService.
//  • Access  Registers IAssignedAppraiserCheck.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure;
using RealEstateEval.Valuation.Infrastructure.Integration;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Infrastructure.Persistence;
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
        // The deposit certificate and the generated final report are stored through the Attachments API.
        services.AddRemoteAttachmentFileStore(configuration);
        services.AddRemoteAuditLogAppend(configuration);
 // The valuation-request write path: context, per-producer outbox publisher (D5),
 // HTTP PO-number lookup, and the request service.
        services.AddValuationPersistence(configuration, connectionString);
        // Valuation already runs MessagingRetentionHostedService for its local outbox;
        // that sweep also removes owner-local idempotency rows.
        services.AddOwnerCommandIdempotencyPersistence<ValuationDbContext>(
            configuration,
            addRetentionHostedService: false);
        services.AddScoped<IValuationEventPublisher, ValuationOutboxPublisher>();
        services.AddScoped<IPropertyPoNumberLookup, RemotePropertyPoNumberLookup>();
        services.AddScoped<IValuationRequestService, ValuationRequestService>();
        // Phase 5: merge / unmerge of transactions folds the deeds' requests into the holder's.
        services.AddScoped<IValuationRequestFolding, ValuationRequestFoldingService>();
        services.AddHttpClient<ICaseStudyRecallCommands, HttpCaseStudyRecallCommands>();
        // Decision 2026-10-19: the report number is drawn from the transaction's PR root owned by Case Study.
        services.AddHttpClient<ICaseStudyCommands, HttpCaseStudyCommands>();
        services.AddScoped<ValuationTimelineWriter>();
        services.AddScoped<IEvaluatorRecallsService, EvaluatorRecallsService>();
        services.AddScoped<IComparablePropertyRepository, ComparablePropertyRepository>();
        services.AddScoped<IComparablePropertyService, ComparablePropertyService>();
        services.AddScoped<PropertyComparableLinkService>();
        services.AddScoped<IPropertyComparableLinkService>(sp =>
            sp.GetRequiredService<PropertyComparableLinkService>());
        services.AddScoped<IValuationComparableSelectionRepository, ValuationComparableSelectionRepository>();
        services.AddScoped<IValuationComparableSelectionService, ValuationComparableSelectionService>();
        services.AddScoped<IValuationApproachSettingsService, ValuationApproachSettingsService>();
        services.AddScoped<IValuationReportFreezeGate, ValuationReportFreezeGate>();
        services.AddScoped<IValuationCostApproachRepository, ValuationCostApproachRepository>();
        services.AddScoped<IValuationCostApproachService, ValuationCostApproachService>();
        services.AddScoped<IValuationIncomeApproachRepository, ValuationIncomeApproachRepository>();
        services.AddScoped<IValuationIncomeApproachService, ValuationIncomeApproachService>();
        services.AddScoped<IValuationReconciliationRepository, ValuationReconciliationRepository>();
        services.AddScoped<IValuationReconciliationService, ValuationReconciliationService>();
        services.AddScoped<IValuationValueDocumentService, ValuationValueDocumentService>();
        services.AddScoped<IValuationValuedDocumentLookup, ValuationValuedDocumentLookup>();
        services.AddScoped<IValuationIssuanceGateService, ValuationIssuanceGateService>();
        services.AddScoped<IValuationReportDocumentService, ValuationReportDocumentService>();
        // Q-6: two-phase issuance + deposit certificate.
        services.AddScoped<IValuationReportIssuanceService, ValuationReportIssuanceService>();
        // Only the assigned appraiser writes a valuation (report draft + every valuation-work write).
        services.AddScoped<IAssignedAppraiserCheck, AssignedAppraiserCheck>();
        // The report draft: the specialist prepares, the appraiser approves (freezes the deposit copy).
        services.AddScoped<IValuationReportDraftService, ValuationReportDraftService>();
        // Report PDF links: browser-rendered HTML → Gotenberg (Chromium) → stored PDF behind a signed key.
        services.Configure<PdfRendererOptions>(configuration.GetSection("PdfRenderer"));
        services.Configure<ReportPdfLinkOptions>(configuration.GetSection("ReportPdfLinks"));
        services.AddHttpClient<IHtmlPdfRenderer, GotenbergHtmlPdfRenderer>(client =>
            client.Timeout = TimeSpan.FromSeconds(180));
        services.AddHttpClient<IPdfMerger, GotenbergPdfMerger>(client =>
            client.Timeout = TimeSpan.FromSeconds(180));
        services.AddScoped<IValuationFinalReportService, ValuationFinalReportService>();
        services.AddSingleton<IReportLinkSigner, ReportLinkSigner>();
        services.AddScoped<IValuationReportPdfService, ValuationReportPdfService>();
        services.AddScoped<IValuationRequestLookup, ValuationRequestLookup>();
        services.AddScoped<IValuationPrintableAttachmentLookup, ValuationPrintableAttachmentLookup>();
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
        return services.AddBoundedContextPersistence<ValuationDbContext>(configuration);
    }

}
