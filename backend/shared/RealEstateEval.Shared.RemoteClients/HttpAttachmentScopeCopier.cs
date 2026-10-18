using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Scope copies through the Attachments internal API (owner-to-owner dispatch; forwards the
/// caller's bearer and the upstream marker the route requires).
/// </summary>
public sealed class HttpAttachmentScopeCopier(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IAttachmentScopeCopier
{
    public async Task<IReadOnlyList<CopiedAttachmentDto>> CopyScopeAsync(
        CopyAttachmentScopeRequest request,
        CancellationToken cancellationToken = default) =>
        await UpstreamJson.SendAsync<List<CopiedAttachmentDto>>(
            http,
            httpContext,
            options.Value.AttachmentsBaseUrl,
            HttpMethod.Post,
            "/api/attachments/copy-scope",
            request,
            "UpstreamServices:AttachmentsBaseUrl",
            cancellationToken);
}
