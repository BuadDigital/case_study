using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpPartyBillingStatementService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPartyBillingStatementService
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";
    private const string Root = "/api/financial-dispatch/party-billing-statements";

    public async Task<IReadOnlyList<PartyBillingReadyLineDto>> ListReadyLinesAsync(
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var path = $"{Root}/ready-lines";
        if (!string.IsNullOrWhiteSpace(assigneeId))
            path += $"?assigneeId={Uri.EscapeDataString(assigneeId)}";
        return await GetAsync<List<PartyBillingReadyLineDto>>(path, cancellationToken);
    }

    public async Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default)
    {
        var path = $"{Root}?issuedOrLaterOnly={issuedOrLaterOnly}";
        if (!string.IsNullOrWhiteSpace(assigneeId))
            path += $"&assigneeId={Uri.EscapeDataString(assigneeId)}";
        if (!string.IsNullOrWhiteSpace(status))
            path += $"&status={Uri.EscapeDataString(status)}";
        return await GetAsync<List<PartyBillingStatementDto>>(path, cancellationToken);
    }

    public Task<PartyBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<PartyBillingStatementDto>(
            http, httpContext, options.Value.FinancialBaseUrl, $"{Root}/{statementId:D}", Setting, cancellationToken);

    public Task<CreatePartyBillingStatementResponseDto> CreateStatementAsync(
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        SendAsync<CreatePartyBillingStatementResponseDto>(
            HttpMethod.Post,
            Root,
            new PartyBillingCreateDispatchRequest { Request = request, ActorUserId = actorUserId },
            cancellationToken);

    public Task<CreateMonthPartyBillingStatementsResponseDto> CreateMonthVendorStatementsAsync(
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        SendAsync<CreateMonthPartyBillingStatementsResponseDto>(
            HttpMethod.Post,
            $"{Root}/month-vendor",
            new ActorUserRequest { ActorUserId = actorUserId },
            cancellationToken);

    public Task<(PartyBillingStatementDto? Statement, string? Error)> IssueStatementAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PartyBillingStatementDto>(
            $"{Root}/{statementId:D}/issue",
            new ActorUserRequest { ActorUserId = actorUserId },
            cancellationToken);

    public Task<(PartyBillingStatementDto? Statement, string? Error)> SubmitVendorInvoiceAsync(
        Guid statementId,
        SubmitVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PartyBillingStatementDto>(
            $"{Root}/{statementId:D}/vendor-invoice",
            new PartyBillingVendorInvoiceDispatchRequest { Request = request, ActorUserId = actorUserId },
            cancellationToken);

    public Task<(PartyBillingStatementDto? Statement, string? Error)> MatchVendorInvoiceAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PartyBillingStatementDto>(
            $"{Root}/{statementId:D}/match-vendor-invoice",
            new ActorUserRequest { ActorUserId = actorUserId },
            cancellationToken);

    public Task<(PartyBillingStatementDto? Statement, string? Error)> RejectVendorInvoiceAsync(
        Guid statementId,
        RejectVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PartyBillingStatementDto>(
            $"{Root}/{statementId:D}/reject-vendor-invoice",
            new PartyBillingRejectInvoiceDispatchRequest { Request = request, ActorUserId = actorUserId },
            cancellationToken);

    public Task<(PartyBillingStatementDto? Statement, string? Error)> CloseStatementAsync(
        Guid statementId,
        ClosePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PartyBillingStatementDto>(
            $"{Root}/{statementId:D}/close",
            new PartyBillingCloseDispatchRequest { Request = request, ActorUserId = actorUserId },
            cancellationToken);

    public Task<(PartyBillingStatementDto? Statement, string? Error)> CancelStatementAsync(
        Guid statementId,
        CancelPartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostWithErrorAsync<PartyBillingStatementDto>(
            $"{Root}/{statementId:D}/cancel",
            new PartyBillingCancelDispatchRequest { Request = request, ActorUserId = actorUserId },
            cancellationToken);

    public Task<DeferPartyBillingLinesResponseDto> DeferLinesAsync(
        DeferPartyBillingLinesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        SendAsync<DeferPartyBillingLinesResponseDto>(
            HttpMethod.Post,
            $"{Root}/defer-lines",
            new PartyBillingDeferDispatchRequest { Request = request, ActorUserId = actorUserId },
            cancellationToken);

    private Task<T> GetAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, path, Setting, cancellationToken);

    private Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken cancellationToken) =>
        UpstreamJson.SendAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, method, path, body, Setting, cancellationToken);

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
