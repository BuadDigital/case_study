using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Phase 5: Case Study folds / unfolds valuation requests on the Valuation host at merge time.</summary>
public sealed class HttpValuationRequestFolding(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IValuationRequestFolding
{
    public Task<FoldValuationRequestsResultDto> FoldAsync(
        FoldValuationRequestsRequest request,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.SendAsync<FoldValuationRequestsResultDto>(
            http,
            httpContext,
            options.Value.ValuationBaseUrl,
            HttpMethod.Post,
            "/api/valuation-request-dispatch/fold",
            request,
            "UpstreamServices:ValuationBaseUrl",
            cancellationToken);

    public Task<FoldValuationRequestsResultDto> UnfoldAsync(
        UnfoldValuationRequestRequest request,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.SendAsync<FoldValuationRequestsResultDto>(
            http,
            httpContext,
            options.Value.ValuationBaseUrl,
            HttpMethod.Post,
            "/api/valuation-request-dispatch/unfold",
            request,
            "UpstreamServices:ValuationBaseUrl",
            cancellationToken);
}
