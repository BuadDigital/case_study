using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpKeyReceiptFeeChargeService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IKeyReceiptFeeChargeService
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";
    private const string Root = "/api/financial-dispatch/key-receipt-charges";

    public async Task<IReadOnlyList<KeyReceiptFeeChargeDto>> ListAsync(
        CancellationToken cancellationToken = default) =>
        await UpstreamJson.GetAsync<List<KeyReceiptFeeChargeDto>>(
            http, httpContext, options.Value.FinancialBaseUrl, Root, Setting, cancellationToken);

    public Task DeleteForEnvelopeAsync(
        Guid envelopeId,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.DeleteAsync(
            http, httpContext, options.Value.FinancialBaseUrl, $"{Root}/{envelopeId:D}", Setting, cancellationToken);

    public async Task<(KeyReceiptFeeChargeDto? Charge, string? Error)> MarkCollectedAsync(
        Guid envelopeId,
        string? invoiceReference,
        CancellationToken cancellationToken = default)
    {
        var (row, errors) = await UpstreamJson.PostForResultAsync<KeyReceiptFeeChargeDto>(
            http, httpContext, options.Value.FinancialBaseUrl,
            $"{Root}/{envelopeId:D}/collect",
            new MarkKeyReceiptFeeCollectedRequest { InvoiceReference = invoiceReference },
            Setting, cancellationToken);
        if (errors is null || errors.Count == 0)
            return (row, null);
        return (row, errors.TryGetValue("_", out var message) ? message : errors.Values.First());
    }

    public async Task<IReadOnlyList<PoEnfazKeyRevenueLineDto>> ListKeyRevenueLinesAsync(
        IReadOnlyList<Guid> envelopeIds,
        CancellationToken cancellationToken = default) =>
        await UpstreamJson.SendAsync<List<PoEnfazKeyRevenueLineDto>>(
            http, httpContext, options.Value.FinancialBaseUrl, HttpMethod.Post,
            $"{Root}/enfaz-lines",
            new GuidListRequest { Ids = envelopeIds },
            Setting, cancellationToken);

    public async Task<IReadOnlyDictionary<string, PoEnfazInvoiceRefDto>> GetInvoicesByPoAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        var rows = await UpstreamJson.SendAsync<Dictionary<string, PoEnfazInvoiceRefDto>>(
            http, httpContext, options.Value.FinancialBaseUrl, HttpMethod.Post,
            $"{Root}/enfaz-invoices",
            new StringListRequest { Values = poNumbers },
            Setting, cancellationToken);
        return new Dictionary<string, PoEnfazInvoiceRefDto>(rows, StringComparer.Ordinal);
    }
}
