using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpPoEnfazInvoiceLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPoEnfazInvoiceLookup
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";

    public async Task<IReadOnlyList<string>> ListBilledPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        if (poNumbers.Count == 0)
            return [];

        return await UpstreamJson.SendAsync<List<string>>(
            http,
            httpContext,
            options.Value.FinancialBaseUrl,
            HttpMethod.Post,
            "/api/financial-dispatch/po-enfaz-invoices/billed",
            new StringListRequest { Values = poNumbers },
            Setting,
            cancellationToken);
    }
}
