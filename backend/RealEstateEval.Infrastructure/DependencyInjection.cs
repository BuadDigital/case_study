using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Storage;

namespace RealEstateEval.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddPersistence(configuration, connectionString);
        services.AddIdentityInfrastructure();
        services.AddCaseStudyInfrastructure();
        return services;
    }

    public static IServiceCollection AddPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString));
        services.AddRedisCaching(configuration);
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

    public static IServiceCollection AddIdentityInfrastructure(this IServiceCollection services)
    {
        services
            .AddIdentity<ApplicationUser, IdentityRole>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 6;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IUserRegistrationService, UserRegistrationService>();
        services.AddScoped<IPermissionService, PermissionService>();
        return services;
    }

    public static IServiceCollection AddBlobStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<BlobStorageOptions>(configuration.GetSection("BlobStorage"));
        services.AddSingleton<IBlobStorage, LocalFileBlobStorage>();
        return services;
    }

    /// <summary>Work orders, workflow tasks, and case-study / party forms.</summary>
    public static IServiceCollection AddCaseStudyCoreInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IWorkOrderService, WorkOrderService>();
        services.AddScoped<IWorkflowTaskService, WorkflowTaskService>();
        services.AddScoped<ICaseStudyFormService, CaseStudyFormService>();
        services.AddScoped<IPartyTaskSubmissionService, PartyTaskSubmissionService>();
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        services.AddScoped<IFieldInspectionAttachmentVerifier, FieldInspectionAttachmentVerifier>();
        services.AddScoped<IPropertyTimelineService, PropertyTimelineService>();
        return services;
    }

    /// <summary>PO intake drafts, delegation letters, suspended-transaction reads.</summary>
    public static IServiceCollection AddCaseStudyAuxiliaryInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IPoIntakeDraftService, PoIntakeDraftService>();
        services.AddScoped<IInternalDelegationLettersService, InternalDelegationLettersService>();
        services.AddScoped<ISuspendedTransactionsService, SuspendedTransactionsService>();
        return services;
    }

    public static IServiceCollection AddCaseStudyInfrastructure(this IServiceCollection services)
    {
        services.AddCaseStudyCoreInfrastructure();
        services.AddCaseStudyAuxiliaryInfrastructure();
        services.AddScoped<ISystemMaintenanceService, SystemMaintenanceService>();
        return services;
    }

    public static IServiceCollection AddFailuresInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IInspectorFeeService, InspectorFeeService>();
        services.AddScoped<IWorkflowTaskService, WorkflowTaskService>();
        services.AddScoped<IFailureService, FailureService>();
        services.AddScoped<IFailureTypesCatalogService, FailureTypesCatalogService>();
        return services;
    }

    public static IServiceCollection AddAttachmentsInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IAttachmentService, AttachmentService>();
        return services;
    }

    public static IServiceCollection AddFinancialInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IFinancialReportService, FinancialReportService>();
        return services;
    }

    public static IServiceCollection AddOperationsInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<ISurveyOfficesService, SurveyOfficesService>();
        services.AddScoped<IPropertyKeysService, PropertyKeysService>();
        return services;
    }

    public static IServiceCollection AddPlatformInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IFieldDictionaryService, FieldDictionaryService>();
        services.AddScoped<ICourtsCatalogService, CourtsCatalogService>();
        services.AddScoped<ICaseStudyInfoRolesConfigService, CaseStudyInfoRolesConfigService>();
        return services;
    }

    public static IServiceCollection AddValuationInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IValuationRequestService, ValuationRequestService>();
        services.AddScoped<IEvaluatorRecallsService, EvaluatorRecallsService>();
        return services;
    }

    /// <summary>
    /// Transactional outbox writer — use on any service that publishes integration events.
    /// Does not start a background dispatcher.
    /// </summary>
    public static IServiceCollection AddIntegrationEventPublishing(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMQ"));
        services.AddScoped<IIntegrationEventPublisher, OutboxIntegrationEventPublisher>();
        return services;
    }

    /// <summary>
    /// Polls <c>OutboxMessages</c> and publishes to RabbitMQ. Register on <b>one</b> service only (case-study).
    /// </summary>
    public static IServiceCollection AddOutboxDispatcher(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RabbitMqOptions>(configuration.GetSection("RabbitMQ"));
        services.AddSingleton<RabbitMqMessagePublisher>();
        services.AddHostedService<OutboxDispatcherHostedService>();
        return services;
    }

    /// <summary>RabbitMQ event handlers for <c>ValuationIntegrationEventConsumer</c> (case-study).</summary>
    public static IServiceCollection AddValuationIntegrationHandlers(this IServiceCollection services)
    {
        services.AddScoped<ValuationReportWorkflowHandler>();
        services.AddScoped<ValuationRequestCreatedHandler>();
        return services;
    }
}
