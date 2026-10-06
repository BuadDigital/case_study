using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpAttachmentPrintDictionaryService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IAttachmentPrintDictionaryService
{
    public Task<AttachmentPrintDictionaryDto> GetAsync(CancellationToken cancellationToken = default) =>
        UpstreamJson.GetAsync<AttachmentPrintDictionaryDto>(
            http,
            httpContext,
            options.Value.PlatformBaseUrl,
            "/api/attachment-print-dictionary",
            "UpstreamServices:PlatformBaseUrl",
            cancellationToken);

    public Task<AttachmentPrintDictionaryDto> SaveAsync(
        SaveAttachmentPrintDictionaryRequest request,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException(
            "Print-dictionary writes belong on the Platform API.");
}

public sealed class HttpValuationListsService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IValuationListsService
{
    public Task<ValuationListsDto> GetAsync(CancellationToken cancellationToken = default) =>
        UpstreamJson.GetAsync<ValuationListsDto>(
            http,
            httpContext,
            options.Value.PlatformBaseUrl,
            "/api/valuation-lists",
            "UpstreamServices:PlatformBaseUrl",
            cancellationToken);

    public Task<ValuationListsDto> SaveAsync(
        SaveValuationListsRequest request,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException(
            "Valuation-lists writes belong on the Platform API.");
}

/// <summary>
/// Reads the info-roles matrix from the Platform API (<c>GET /api/case-study-info-roles</c>,
/// authorize-only — the caller's bearer is forwarded). Parses only the part the 100% completeness
/// rule needs, so no Platform contract type is referenced. An unreachable or unreadable upstream
/// yields null: the use case fails closed instead of treating «can't read» as «no questions».
/// </summary>
public sealed class HttpCaseStudyInfoRolesLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ICaseStudyInfoRolesLookup
{
    public async Task<IReadOnlyDictionary<string, IReadOnlyCollection<string>>?> GetQuestionRolesAsync(
        CancellationToken cancellationToken = default)
    {
        InfoRolesPayload? payload;
        try
        {
            payload = await UpstreamJson.GetOrDefaultAsync<InfoRolesPayload>(
                http,
                httpContext,
                options.Value.PlatformBaseUrl,
                "/api/case-study-info-roles",
                "UpstreamServices:PlatformBaseUrl",
                cancellationToken,
                allowNotFound: false);
        }
        catch (Exception ex) when (
            ex is HttpRequestException or InvalidOperationException or System.Text.Json.JsonException
            || (ex is OperationCanceledException && !cancellationToken.IsCancellationRequested))
        {
            return null;
        }

        if (payload?.Matrix is null) return null;

        var result = new Dictionary<string, IReadOnlyCollection<string>>(StringComparer.Ordinal);
        foreach (var (questionKey, parties) in payload.Matrix)
        {
            if (string.IsNullOrWhiteSpace(questionKey)) continue;
            result[questionKey.Trim()] = (parties ?? [])
                .Where(p => !string.IsNullOrWhiteSpace(p.Key)
                    && !string.IsNullOrWhiteSpace(p.Value)
                    && !string.Equals(p.Value.Trim(), "none", StringComparison.OrdinalIgnoreCase))
                .Select(p => p.Key)
                .ToList();
        }

        return result;
    }

    private sealed class InfoRolesPayload
    {
        public Dictionary<string, Dictionary<string, string?>>? Matrix { get; set; }
    }
}

public sealed class HttpOrganizationSettingsService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IOrganizationSettingsService
{
    public Task<OrganizationSettingsDto> GetAsync(CancellationToken cancellationToken = default) =>
        UpstreamJson.GetAsync<OrganizationSettingsDto>(
            http,
            httpContext,
            options.Value.PlatformBaseUrl,
            "/api/organization-settings",
            "UpstreamServices:PlatformBaseUrl",
            cancellationToken);

    /// <summary>
    /// Remote hosts do not receive communication secrets. Evaluator / SLA / valuation
    /// fields used by issuance gates are present on the public GET.
    /// </summary>
    public Task<OrganizationSettingsDto> GetInternalAsync(CancellationToken cancellationToken = default) =>
        GetAsync(cancellationToken);

    public Task<OrganizationSettingsDto> SaveAsync(
        SaveOrganizationSettingsRequest request,
        string actorId,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException(
            "Organization-settings writes belong on the Platform API.");

    public Task<OrganizationSettingsDto> SyncStaffValuerAsync(
        SyncStaffValuerRequest request,
        string actorId,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException(
            "Organization-settings writes belong on the Platform API.");
}
