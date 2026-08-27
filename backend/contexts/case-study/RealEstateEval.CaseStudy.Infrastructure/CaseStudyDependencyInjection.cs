using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Services;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Persistence;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure;

/// <summary>
/// Context-local registration for the Case Study bounded context (A8): work orders, workflow
/// tasks, case-study/party forms, field inspection, and the valuation integration handler.
/// The lookup/command concretes other contexts construct stay global; shared persistence and
/// HTTP plumbing still come from the global Infrastructure extensions.
/// </summary>
public static class CaseStudyDependencyInjection
{
 /// <summary>Work orders, workflow tasks, and case-study / party forms.</summary>
    public static IServiceCollection AddCaseStudyCoreInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IWorkOrderLoader, WorkOrderLoader>();
        services.AddScoped<IWorkOrderQuery, WorkOrderQueryService>();
        services.AddScoped<IWorkOrderPropertyCommands, WorkOrderPropertyCommands>();
        services.AddScoped<IWorkOrderService, WorkOrderService>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IBuildingInventoryService, BuildingInventoryService>();
        services.AddScoped<IPropertyGroupService, PropertyGroupService>();
        services.AddWorkflowTaskCollaborators();
        services.AddScoped<IWorkOrderVisibilityFilter, WorkOrderVisibilityFilter>();
        services.AddScoped<ICaseStudyFormService, CaseStudyFormService>();
        services.AddScoped<ICaseStudyValuationDispatchService, CaseStudyValuationDispatchService>();
        services.AddScoped<IPartyTaskSubmissionService, PartyTaskSubmissionService>();
        services.AddScoped<IFieldInspectionWorkspaceService, FieldInspectionWorkspaceService>();
        services.AddScoped<IFieldInspectionAttachmentVerifier, FieldInspectionAttachmentVerifier>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        services.AddScoped<IWorkflowTaskShellPatcher, WorkflowTaskShellPatcher>();
        services.AddScoped<IPropertyAccessHoldService, PropertyAccessHoldService>();
        return services;
    }


 /// <summary>PO intake drafts, delegation letters, suspended-transaction reads.</summary>
    public static IServiceCollection AddCaseStudyAuxiliaryInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IPoIntakeDraftRepository, PoIntakeDraftRepository>();
        services.AddScoped<IPoIntakeDraftService, PoIntakeDraftService>();
        services.AddScoped<ISuspendedTransactionsService, SuspendedTransactionsService>();
        return services;
    }

    public static IServiceCollection AddCaseStudyInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
 // Hosts that call this must have registered AddCaseStudyPersistence.
        services.AddCaseStudyCoreInfrastructure();
        services.AddCaseStudyAuxiliaryInfrastructure();
        services.AddScoped<IWorkflowAssigneeLookup, WorkflowAssigneeLookup>();
        services.AddScoped<ICaseStudyLookup, CaseStudyLookup>();
        services.AddScoped<ICaseStudyCommands, CaseStudyCommands>();
        services.AddScoped<ICaseStudyFailureCommands, CaseStudyFailureCommands>();
        services.AddScoped<IInspectionLimitsService, InspectionLimitsService>();
        services.AddRemoteAttachmentLookup(configuration);
        services.AddRemotePlatformCatalogs(configuration);
        services.AddRemoteValuationRequests(configuration);
        services.AddRemoteIdentityDirectory(configuration);
        services.AddRemoteAuditLogAppend(configuration);
        services.AddRemoteFailures(configuration);
        services.AddRemoteOperations(configuration);
        services.AddRemoteFinancial(configuration);
        services.AddNotificationInfrastructure(configuration, environment);
        return services;
    }


 /// <summary>Workflow task façade + query / distribution / lifecycle collaborators.</summary>
    public static IServiceCollection AddWorkflowTaskCollaborators(this IServiceCollection services)
    {
        services.AddScoped<IWorkflowTaskVisibilityFilter, WorkflowTaskVisibilityFilter>();
        services.AddScoped<IWorkflowTaskQuery, WorkflowTaskQueryService>();
        services.AddScoped<IDashboardOpsMetricsQuery, DashboardOpsMetricsQueryService>();
        services.AddScoped<IWorkflowTaskSlotSynchronizer, WorkflowTaskSlotSynchronizer>();
        services.AddScoped<IWorkflowTaskDistributionCommands, WorkflowTaskDistributionCommands>();
        services.AddScoped<WorkflowTaskCascadeCleanup>();
        services.AddScoped<IWorkflowTaskLifecycleCommands, WorkflowTaskLifecycleCommands>();
        services.AddScoped<IWorkflowTaskService, WorkflowTaskService>();
        return services;
    }

    /// <summary>RabbitMQ event handlers for <c>ValuationIntegrationEventConsumer</c> (case-study).</summary>
    public static IServiceCollection AddValuationIntegrationHandlers(this IServiceCollection services)
    {
        services.AddScoped<ValuationReportWorkflowHandler>();
        return services;
    }
 /// <summary>Case Study write context. Prefers a dedicated Case Study connection string.
 /// A8 physical move: lives beside <see cref="CaseStudyDbContext"/>.</summary>
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

}
