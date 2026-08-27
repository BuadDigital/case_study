using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Infrastructure.Storage;

namespace RealEstateEval.Infrastructure;

/// <summary>
/// Context-local registration for the Attachments bounded context (A8). The shared
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
        services.AddRemotePlatformCatalogs(configuration);
        services.Configure<BlobStorageOptions>(configuration.GetSection("BlobStorage"));
        services.AddSingleton<IBlobStorage, LocalFileBlobStorage>();
        services.AddScoped<IAttachmentLookup, AttachmentLookup>();
        services.AddScoped<IAttachmentService, AttachmentService>();
        return services;
    }

 /// <summary>Attachments write context. Prefers a dedicated Attachments connection string.
 /// A8 physical move: lives beside <see cref="AttachmentsDbContext"/> in the context library.</summary>
    public static IServiceCollection AddAttachmentsPersistence(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
 // Block body (not expression-bodied): architecture fan-out scans method braces.
        var attachmentsConnection = BoundedContextConnections.Resolve(
            configuration,
            BoundedContextConnections.ServiceNames.Attachments,
            connectionString);
        return services.AddBoundedContextPersistence<AttachmentsDbContext>(
            configuration,
            attachmentsConnection);
    }
}
