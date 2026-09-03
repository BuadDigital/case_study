using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpPoEnfazBillingService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPoEnfazBillingService
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";
    private const string Root = "/api/financial-dispatch/enfaz-billing";

    public async Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<EnfazReadyPoSummaryDto>>($"{Root}/ready-pos-summary", cancellationToken);

    public Task<PoEnfazBillingDto?> GetPoBillingAsync(
        string poNumber,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<PoEnfazBillingDto>(
            http, httpContext, options.Value.FinancialBaseUrl,
            $"{Root}/{Uri.EscapeDataString(poNumber)}", Setting, cancellationToken);

    public async Task<PoEnfazBillingDto?> SavePoBillingAsync(
        string poNumber,
        SavePoEnfazBillingRequest request,
        CancellationToken cancellationToken = default)
    {
        var (dto, _) = await UpstreamJson.SendForResultAsync<PoEnfazBillingDto>(
            http, httpContext, options.Value.FinancialBaseUrl, HttpMethod.Put,
            $"{Root}/{Uri.EscapeDataString(poNumber)}",
            request, Setting, cancellationToken);
        return dto;
    }

    public Task<PropertyEnfazRevenueDto?> GetPropertyRevenueAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<PropertyEnfazRevenueDto>(
            http, httpContext, options.Value.FinancialBaseUrl,
            $"{Root}/{Uri.EscapeDataString(poNumber)}/properties/{propertyId:D}",
            Setting, cancellationToken);

    public async Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<EnfazTrackingRowDto>>($"{Root}/tracking", cancellationToken);

    public Task<PoEnfazBillingDto?> IssueInvoiceAsync(
        string poNumber,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<PoEnfazBillingDto>(
            $"{Root}/{Uri.EscapeDataString(poNumber)}/issue-invoice",
            null,
            cancellationToken);

    public Task<(PoEnfazBillingDto? Billing, string? Error)> CollectInvoiceAsync(
        string poNumber,
        CollectPoEnfazInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PoEnfazBillingDto>(
            $"{Root}/{Uri.EscapeDataString(poNumber)}/collect",
            new CollectPoEnfazInvoiceDispatchRequest { Collect = request, ActorUserId = actorUserId },
            cancellationToken);

    public Task<EnfazAgingReportDto> GetAgingReportAsync(
        CancellationToken cancellationToken = default) =>
        GetAsync<EnfazAgingReportDto>($"{Root}/aging", cancellationToken);

    public Task<byte[]?> GetInvoicePdfAsync(
        string poNumber,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetBytesOrDefaultAsync(
            http, httpContext, options.Value.FinancialBaseUrl,
            $"{Root}/{Uri.EscapeDataString(poNumber)}/invoice.pdf",
            Setting, cancellationToken);

    public async Task<IReadOnlyList<EnfazFollowupDto>> ListFollowupsAsync(
        string poNumber,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<EnfazFollowupDto>>(
            $"{Root}/{Uri.EscapeDataString(poNumber)}/followups",
            cancellationToken);

    public Task<(EnfazFollowupDto? Followup, string? Error)> AddFollowupAsync(
        string poNumber,
        AddEnfazFollowupRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<EnfazFollowupDto>(
            $"{Root}/{Uri.EscapeDataString(poNumber)}/followups",
            new AddEnfazFollowupDispatchRequest { Followup = request, ActorUserId = actorUserId },
            cancellationToken);

    public async Task<(bool Ok, string? Error)> SetFinanceFlagAsync(
        string poNumber,
        SetEnfazFinanceFlagRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var (_, error) = await PostWithErrorAsync<object>(
            $"{Root}/{Uri.EscapeDataString(poNumber)}/finance-flag",
            new SetEnfazFinanceFlagDispatchRequest { Flag = request, ActorUserId = actorUserId },
            cancellationToken);
        return (error is null, error);
    }

    public async Task<(bool Ok, string? Error)> ClearFinanceFlagAsync(
        string poNumber,
        string? propertyId,
        CancellationToken cancellationToken = default)
    {
        var path = $"{Root}/{Uri.EscapeDataString(poNumber)}/finance-flag";
        if (!string.IsNullOrWhiteSpace(propertyId))
            path += $"?propertyId={Uri.EscapeDataString(propertyId)}";
        try
        {
            await UpstreamJson.DeleteAsync(
                http, httpContext, options.Value.FinancialBaseUrl, path, Setting, cancellationToken);
            return (true, null);
        }
        catch (HttpRequestException ex)
        {
            return (false, ex.Message);
        }
    }

    private Task<T> GetAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, path, Setting, cancellationToken);

    private async Task<T?> PostNullableAsync<T>(string path, object? body, CancellationToken cancellationToken)
    {
        var (result, _) = await UpstreamJson.PostForResultAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, path, body, Setting, cancellationToken);
        return result;
    }

    private async Task<(T? Result, string? Error)> PostWithErrorAsync<T>(
        string path,
        object? body,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await UpstreamJson.PostForResultAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, path, body, Setting, cancellationToken);
        if (errors is null || errors.Count == 0)
            return (result, null);
        return (result, errors.TryGetValue("_", out var message) ? message : errors.Values.First());
    }
}
