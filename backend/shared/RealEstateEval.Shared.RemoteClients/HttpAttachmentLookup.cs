using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Application.Contracts;
namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpAttachmentLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IAttachmentLookup
{
    public async Task<bool> ExistsAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        _ = actor;
        var body = await UpstreamJson.GetAsync<AttachmentExistsDto>(
            http,
            httpContext,
            options.Value.AttachmentsBaseUrl,
            $"/api/attachments/{id:D}/exists",
            "UpstreamServices:AttachmentsBaseUrl",
            cancellationToken);
        return body.Exists;
    }

    public async Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        _ = actor;
        if (ids.Count == 0)
            return [];

        var query = string.Join(",", ids.Distinct().Take(200).Select(id => id.ToString("D")));
        var list = await UpstreamJson.GetAsync<List<AttachmentRefDto>>(
            http,
            httpContext,
            options.Value.AttachmentsBaseUrl,
            $"/api/attachments/lookup?ids={Uri.EscapeDataString(query)}",
            "UpstreamServices:AttachmentsBaseUrl",
            cancellationToken);
        return list;
    }

    public async Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        _ = actor;
        if (string.IsNullOrWhiteSpace(propertyId))
            return [];

        var list = await UpstreamJson.GetAsync<List<FileAttachmentMetaDto>>(
            http,
            httpContext,
            options.Value.AttachmentsBaseUrl,
            $"/api/attachments/for-property?propertyId={Uri.EscapeDataString(propertyId.Trim())}",
            "UpstreamServices:AttachmentsBaseUrl",
            cancellationToken);
        return list;
    }
}