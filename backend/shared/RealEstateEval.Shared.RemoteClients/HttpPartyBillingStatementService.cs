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

    public Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default) =>
        ListStatementsAsync(
            new PartyBillingStatementListQuery
            {
                AssigneeId = assigneeId,
                Status = status,
                IssuedOrLaterOnly = issuedOrLaterOnly,
            },
            cancellationToken);

    /// <summary>
    /// The list parameters go upstream on the query string, paged or not; the owner re-resolves
    /// the page window from its own <c>Database</c> options, so the skip / take this host computed
    /// are informational only (pagination-contract §9).
    /// </summary>
    public async Task<IReadOnlyList<PartyBillingReadyLineDto>> ListReadyLinesAsync(
        PartyBillingReadyLineListQuery query,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<PartyBillingReadyLineDto>>(
            $"{Root}/ready-lines" + ReadyLinesQueryString(query, paged: false),
            cancellationToken);

    public Task<PagedResultDto<PartyBillingReadyLineDto>> ListReadyLinesPagedAsync(
        PartyBillingReadyLineListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default) =>
        GetAsync<PagedResultDto<PartyBillingReadyLineDto>>(
            $"{Root}/ready-lines" + ReadyLinesQueryString(query, paged: true),
            cancellationToken);

    public async Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        PartyBillingStatementListQuery query,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<PartyBillingStatementDto>>(
            Root + StatementsQueryString(query, paged: false),
            cancellationToken);

    public Task<PagedResultDto<PartyBillingStatementDto>> ListStatementsPagedAsync(
        PartyBillingStatementListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default) =>
        GetAsync<PagedResultDto<PartyBillingStatementDto>>(
            Root + StatementsQueryString(query, paged: true),
            cancellationToken);

    private static string StatementsQueryString(PartyBillingStatementListQuery query, bool paged)
    {
        var parts = new List<string> { $"issuedOrLaterOnly={query.IssuedOrLaterOnly}" };
        if (paged)
        {
            parts.Add($"page={query.Page ?? 1}");
            if (query.PageSize is { } size) parts.Add($"pageSize={size}");
        }
        AddIfSet(parts, "assigneeId", query.AssigneeId);
        AddIfSet(parts, "status", query.Status);
        AddIfSet(parts, "sort", query.Sort);
        AddIfSet(parts, "dir", query.Dir);
        AddIfSet(parts, "q", query.Q);
        return "?" + string.Join("&", parts);
    }

    private static string ReadyLinesQueryString(PartyBillingReadyLineListQuery query, bool paged)
    {
        var parts = new List<string>();
        if (paged)
        {
            parts.Add($"page={query.Page ?? 1}");
            if (query.PageSize is { } size) parts.Add($"pageSize={size}");
        }
        AddIfSet(parts, "assigneeId", query.AssigneeId);
        AddIfSet(parts, "sort", query.Sort);
        AddIfSet(parts, "dir", query.Dir);
        AddIfSet(parts, "q", query.Q);
        return parts.Count == 0 ? "" : "?" + string.Join("&", parts);
    }

    private static void AddIfSet(List<string> parts, string name, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
            parts.Add($"{name}={Uri.EscapeDataString(value.Trim())}");
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
