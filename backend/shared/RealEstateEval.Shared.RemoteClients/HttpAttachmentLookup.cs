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
    // actor = null is a system check, as in the in-process lookup: it goes out with the service's
    // own token so the attachments service answers for every row, not only the ones the person
    // behind this request may open (2026-10-21: an inspector saving a returned inspection was told
    // the specialist's photo «does not exist»). A non-null actor keeps the caller's token.
    public async Task<bool> ExistsAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var body = await UpstreamJson.GetAsync<AttachmentExistsDto>(
            http,
            httpContext,
            options.Value.AttachmentsBaseUrl,
            $"/api/attachments/{id:D}/exists",
            "UpstreamServices:AttachmentsBaseUrl",
            cancellationToken,
            asService: actor is null);
        return body.Exists;
    }

    public async Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var all = new List<AttachmentRefDto>();
        foreach (var chunk in QueryIdBatch.OfGuids(ids))
        {
            var list = await UpstreamJson.GetAsync<List<AttachmentRefDto>>(
                http,
                httpContext,
                options.Value.AttachmentsBaseUrl,
                $"/api/attachments/lookup?ids={QueryIdBatch.JoinEscaped(chunk)}",
                "UpstreamServices:AttachmentsBaseUrl",
                cancellationToken,
                asService: actor is null);
            all.AddRange(list);
        }

        return all;
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