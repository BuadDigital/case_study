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
    /// <summary>Whether an attachment exists, asked of the attachments service over HTTP.</summary>
    /// <remarks>
    /// How it works: GET /api/attachments/{id}/exists through <c>UpstreamJson.GetAsync</c> with
    /// <c>asService: actor is null</c>, and returns the body's Exists.
    /// Edge cases: actor = null is a system check, as in the in-process lookup — it goes out with the
    /// service's own token (UpstreamServiceBearer) so the attachments service answers for every row,
    /// not only the ones the person behind this request may open. A non-null actor keeps the caller's
    /// token. Fixed 2026-10-21 (prod PO-067455): the inspector saving a returned inspection was told the
    /// specialist's photo «does not exist» because the caller's token was forwarded; in-process (dev) it
    /// never failed because actor = null already skipped filtering there.
    /// </remarks>
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

    /// <summary>References (id, scope, scope key) of the given attachment ids, asked over HTTP.</summary>
    /// <remarks>
    /// How it works: splits the ids into URL-safe batches (<c>QueryIdBatch.OfGuids</c>), calls
    /// GET /api/attachments/lookup?ids=… per batch with <c>asService: actor is null</c>, and concatenates
    /// the answers.
    /// Edge cases: same token rule and 2026-10-21 fix as <see cref="ExistsAsync"/> — a system payload check
    /// (actor = null) sees every row, so a photo the specialist added is not reported missing to the
    /// inspector; the service answers with policy CheckAttachmentRefs (references only, never files).
    /// </remarks>
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