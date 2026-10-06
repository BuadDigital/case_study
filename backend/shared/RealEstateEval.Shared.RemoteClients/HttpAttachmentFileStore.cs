using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Application.Contracts;
namespace RealEstateEval.Infrastructure.Services;

/// <summary>Writes system-generated files through the Attachments HTTP API (forwards the caller's bearer).</summary>
public sealed class HttpAttachmentFileStore(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options,
    ILogger<HttpAttachmentFileStore>? logger = null) : IAttachmentFileStore
{
    private const string Setting = "UpstreamServices:AttachmentsBaseUrl";
    private const string StoreFailedAr = "تعذّر حفظ الملف في خدمة المرفقات";

    public async Task<(Guid? Id, string? Error)> StoreAsync(
        string scope,
        string scopeKey,
        string fileName,
        string contentType,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (meta, errors) = await UpstreamJson.PostForResultAsync<FileAttachmentMetaDto>(
                http,
                httpContext,
                options.Value.AttachmentsBaseUrl,
                "/api/attachments",
                new UploadAttachmentRequest
                {
                    Scope = scope,
                    ScopeKey = scopeKey,
                    FileName = fileName,
                    ContentType = contentType,
                    ContentBase64 = Convert.ToBase64String(content),
                },
                Setting,
                cancellationToken);
            if (errors is not null) return (null, errors.Values.FirstOrDefault() ?? StoreFailedAr);
            return meta is null ? (null, StoreFailedAr) : (meta.Id, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            logger?.LogWarning(ex, "Attachment store call failed for scope {Scope}", scope);
            return (null, StoreFailedAr);
        }
    }

    public async Task<byte[]?> ReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            return await UpstreamJson.GetBytesOrDefaultAsync(
                http, httpContext, options.Value.AttachmentsBaseUrl, $"/api/attachments/{id:D}", Setting, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            logger?.LogWarning(ex, "Attachment read failed for {AttachmentId}", id);
            return null;
        }
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        try
        {
            await UpstreamJson.DeleteAsync(
                http, httpContext, options.Value.AttachmentsBaseUrl, $"/api/attachments/{id:D}", Setting, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            logger?.LogWarning(ex, "Attachment delete failed for {AttachmentId}", id);
        }
    }
}
