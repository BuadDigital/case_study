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
}
