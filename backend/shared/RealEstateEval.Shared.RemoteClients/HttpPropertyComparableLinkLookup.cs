using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpPropertyComparableLinkLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPropertyComparableLinkLookup
{
    public async Task<int> CountLinkedAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var list = await UpstreamJson.GetOrDefaultAsync<PropertyComparableLinkListDto>(
            http,
            httpContext,
            options.Value.ValuationBaseUrl,
            $"/api/property-comparable-links?propertyId={propertyId:D}",
            "UpstreamServices:ValuationBaseUrl",
            cancellationToken);
        return list?.LinkedCount ?? 0;
    }
}
