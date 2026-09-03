using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpKeyEntitlementLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IKeyEntitlementLookup
{
    private const string Setting = "UpstreamServices:OperationsBaseUrl";

    public async Task<IReadOnlyList<KeyEnvelopeEntitlementDto>> ListByPropertyIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default)
    {
        if (propertyIds.Count == 0)
            return [];

        var query = string.Join(",", propertyIds.Distinct().Take(200).Select(id => id.ToString("D")));
        var list = await UpstreamJson.GetAsync<List<KeyEnvelopeEntitlementDto>>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            $"/api/key-envelope-dispatch/entitlements?propertyIds={Uri.EscapeDataString(query)}",
            Setting,
            cancellationToken);
        return list;
    }
}
