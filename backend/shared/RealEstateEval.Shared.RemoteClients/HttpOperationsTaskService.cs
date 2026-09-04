using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Case Study dispatch uses the Operations operator queue (JWT forwarded).
/// Scheduler sweeps stay on the Operations host.
/// </summary>
public sealed class HttpOperationsTaskService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IOperationsTaskService
{
    private const string Setting = "UpstreamServices:OperationsBaseUrl";

    public async Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        _ = (actorUserId, actorAssigneeId, actorRole);
        var qs = new List<string>();
        if (!string.IsNullOrWhiteSpace(assigneeId))
            qs.Add($"assigneeId={Uri.EscapeDataString(assigneeId.Trim())}");
        if (!string.IsNullOrWhiteSpace(createdBy))
            qs.Add($"createdBy={Uri.EscapeDataString(createdBy.Trim())}");
        if (!string.IsNullOrWhiteSpace(status))
            qs.Add($"status={Uri.EscapeDataString(status.Trim())}");

        var path = "/api/operations-tasks" + (qs.Count > 0 ? "?" + string.Join("&", qs) : "");
        var list = await GetAsync<List<OperationsTaskDto>>(path, cancellationToken);
        return list;
    }

    public async Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        _ = (actorUserId, actorAssigneeId, actorRole);
        return await GetAsync<List<OperationsTaskDto>>(
            "/api/operations-tasks" + BuildQueryString(query, paged: false),
            cancellationToken);
    }

    public Task<PagedResultDto<OperationsTaskDto>> ListPagedAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        _ = (actorUserId, actorAssigneeId, actorRole);
        return GetAsync<PagedResultDto<OperationsTaskDto>>(
            "/api/operations-tasks" + BuildQueryString(query, paged: true),
            cancellationToken);
    }

 /// <summary>
 /// Mirrors the query string documented in docs/architecture/pagination-contract.md so a remote
 /// caller gets the same filtering the Operations host applies locally.
 /// </summary>
    private static string BuildQueryString(OperationsTaskListQuery query, bool paged)
    {
        var parts = new List<string>();

        void Add(string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                parts.Add($"{name}={Uri.EscapeDataString(value.Trim())}");
        }

        if (paged)
        {
            parts.Add($"page={query.Page ?? 1}");
            if (query.PageSize.HasValue)
                parts.Add($"pageSize={query.PageSize.Value}");
        }

        Add("assigneeId", query.AssigneeId);
        Add("createdBy", query.CreatedBy);
        Add("status", query.Status);
        Add("scope", query.Scope);
        Add("type", query.Type);
        Add("sort", query.Sort);
        Add("dir", query.Dir);
        Add("q", query.Q);
        if (query.ActiveOnly == true) parts.Add("activeOnly=true");
        if (query.ExcludeFailurePaused == true) parts.Add("excludeFailurePaused=true");

        return parts.Count > 0 ? "?" + string.Join("&", parts) : "";
    }

    public Task<OperationsTaskDto?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Get an operations task on the Operations API.");

    public Task<(OperationsTaskDto? Result, string? Error)> CreateAsync(
        CreateOperationsTaskRequest request,
        string createdBy,
        string? createdByName,
        CancellationToken cancellationToken = default)
    {
        _ = (createdBy, createdByName);
        return SendForServiceResultAsync(
            HttpMethod.Post,
            "/api/operations-tasks",
            request,
            cancellationToken);
    }

    public Task<(OperationsTaskDto? Result, string? Error)> PatchAsync(
        Guid id,
        PatchOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        _ = (actorAssigneeId, actorName, actorRole, actorUserId);
        return SendForServiceResultAsync(
            HttpMethod.Patch,
            $"/api/operations-tasks/{id:D}",
            request,
            cancellationToken);
    }

    public Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        _ = (actorAssigneeId, actorName, actorRole);
        return SendForServiceResultAsync(
            HttpMethod.Post,
            $"/api/operations-tasks/{id:D}/reassign",
            request,
            cancellationToken);
    }

    public Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        _ = (actorName, actorRole);
        return SendForServiceResultAsync(
            HttpMethod.Post,
            $"/api/operations-tasks/{id:D}/remind",
            new RemindOperationsTaskRequest { Auto = auto },
            cancellationToken);
    }

    public Task<int> ProcessDueAutoRemindersAsync(CancellationToken cancellationToken = default)
    {
        _ = cancellationToken;
        throw new InvalidOperationException("Process operations-task reminders on the Operations API.");
    }

    public Task<int> ProcessOverLimitPauseRemindersAsync(CancellationToken cancellationToken = default)
    {
        _ = cancellationToken;
        throw new InvalidOperationException("Process operations-task reminders on the Operations API.");
    }

    public async Task<int> BackfillMissingCourtVisitChargesAsync(
        CancellationToken cancellationToken = default)
    {
        var count = await UpstreamJson.SendAsync<BackfillCountDto>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            HttpMethod.Post,
            "/api/operations-task-dispatch/backfill-visit-charges",
            new { },
            Setting,
            cancellationToken);
        return count.Count;
    }

    public Task<(OperationsTaskDto? Result, string? Error)> AddCommentAsync(
        Guid id,
        AddOperationsTaskCommentRequest request,
        string actorAssigneeId,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default)
    {
        _ = (actorAssigneeId, actorRole, actorName);
        return SendForServiceResultAsync(
            HttpMethod.Post,
            $"/api/operations-tasks/{id:D}/comments",
            request,
            cancellationToken);
    }

    public async Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var path = string.IsNullOrWhiteSpace(creditAssigneeId)
            ? "/api/operations-tasks/court-visit-fees"
            : $"/api/operations-tasks/court-visit-fees?creditAssigneeId={Uri.EscapeDataString(creditAssigneeId.Trim())}";
        var list = await GetAsync<List<CourtVisitFeeReportRowDto>>(path, cancellationToken);
        return list;
    }

    private Task<T> GetAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetAsync<T>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            path,
            Setting,
            cancellationToken);

    private async Task<(OperationsTaskDto? Result, string? Error)> SendForServiceResultAsync(
        HttpMethod method,
        string path,
        object? body,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await UpstreamJson.SendForResultAsync<OperationsTaskDto>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            method,
            path,
            body,
            Setting,
            cancellationToken);
        if (errors is null)
            return (result, null);

        var message = errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
        return (null, string.IsNullOrWhiteSpace(message) ? "الطلب غير صالح." : message);
    }

    private sealed class BackfillCountDto
    {
        public int Count { get; set; }
    }
}
