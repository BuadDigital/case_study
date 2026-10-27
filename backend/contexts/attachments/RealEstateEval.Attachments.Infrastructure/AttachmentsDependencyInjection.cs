using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Attachments.Infrastructure.Storage;
using RealEstateEval.Infrastructure;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Infrastructure.Services;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;

namespace RealEstateEval.Attachments.Infrastructure;

/// <summary>
/// Context-local registration for the Attachments bounded context. The shared
/// persistence/HTTP plumbing still comes from the global Infrastructure extensions.
/// </summary>
public static class AttachmentsDependencyInjection
{
    public static IServiceCollection AddAttachmentsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddAttachmentsPersistence(configuration, connectionString);
        services.AddOwnerCommandIdempotencyPersistence<AttachmentsDbContext>(configuration);
        services.AddRemotePlatformCatalogs(configuration);
        services.AddRemotePropertyTimelineRecorder(configuration);
        services.Configure<BlobStorageOptions>(configuration.GetSection("BlobStorage"));
        services.AddSingleton<IBlobStorage, LocalFileBlobStorage>();
        services.AddScoped<IAttachmentLookup, AttachmentLookup>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        return services;
    }

 /// <summary>Attachments write context. Prefers a dedicated Attachments connection string.
 /// Physical move: lives beside <see cref="AttachmentsDbContext"/> in the context library.</summary>
    public static IServiceCollection AddAttachmentsPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
 // Block body (not expression-bodied): architecture fan-out scans method braces.
        return services.AddBoundedContextPersistence<AttachmentsDbContext>(configuration);
    }
}
