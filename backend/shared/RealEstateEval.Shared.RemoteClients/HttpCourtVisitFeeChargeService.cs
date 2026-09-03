using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpCourtVisitFeeChargeService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ICourtVisitFeeChargeService
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";
    private const string Root = "/api/financial-dispatch/court-visit-charges";

    public async Task<bool> ExistsForTaskAsync(
        Guid operationsTaskId,
        CancellationToken cancellationToken = default)
    {
        var dto = await UpstreamJson.GetAsync<ExistsResponseDto>(
            http, httpContext, options.Value.FinancialBaseUrl,
            $"{Root}/exists?operationsTaskId={operationsTaskId:D}",
            Setting, cancellationToken);
        return dto.Exists;
    }

    public Task AddChargeAsync(
        CreateCourtVisitFeeChargeRequest request,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.PostAsync(
            http, httpContext, options.Value.FinancialBaseUrl, Root, request, Setting, cancellationToken);

    public async Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var path = Root;
        if (!string.IsNullOrWhiteSpace(creditAssigneeId))
            path += $"?creditAssigneeId={Uri.EscapeDataString(creditAssigneeId)}";
        return await UpstreamJson.GetAsync<List<CourtVisitFeeReportRowDto>>(
            http, httpContext, options.Value.FinancialBaseUrl, path, Setting, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, decimal?>> GetAmountsByTaskIdsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default)
    {
        var rows = await UpstreamJson.SendAsync<List<CourtVisitFeeAmountDto>>(
            http, httpContext, options.Value.FinancialBaseUrl, HttpMethod.Post,
            $"{Root}/amounts",
            new GuidListRequest { Ids = taskIds },
            Setting, cancellationToken);
        return rows.ToDictionary(x => x.OperationsTaskId, x => (decimal?)x.AmountSar);
    }

    public async Task<IReadOnlyList<Guid>> ListChargedTaskIdsAsync(
        CancellationToken cancellationToken = default) =>
        await UpstreamJson.GetAsync<List<Guid>>(
            http, httpContext, options.Value.FinancialBaseUrl, $"{Root}/charged-task-ids", Setting, cancellationToken);

}
