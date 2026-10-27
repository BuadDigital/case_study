using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Case Study inspector-fee commands. Operator capability checks stay on Case Study;
/// Financial dispatch routes are authenticated only.
/// </summary>
public sealed class HttpInspectorFeeService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IInspectorFeeService
{
    private const string Setting = "UpstreamServices:FinancialBaseUrl";
    private const string Root = "/api/financial-dispatch/inspector-fees";

    public Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default)
    {
        var ids = tasks.Select(t => t.Id).Distinct().ToList();
        if (ids.Count == 0)
            return Task.CompletedTask;
        return PostAsync($"{Root}/ensure-ledgers", new GuidListRequest { Ids = ids }, cancellationToken);
    }

    public Task EnsureLedgersForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default) =>
        PostAsync($"{Root}/ensure-ledgers-for-property/{propertyId:D}", null, cancellationToken);

    /// <summary>Forwards the accrual (and the optional proposal) to Financial; returns its first error.</summary>
    public async Task<(InspectorFeeRowDto? Row, string? Error)> AccrueEngineeringSurveyFeeAsync(
        Guid workflowTaskId,
        string actorUserId,
        CancellationToken cancellationToken = default,
        EngineeringSurveyDiscountProposalInput? proposal = null)
    {
        var (row, errors) = await PostForResultAsync<InspectorFeeRowDto>(
            $"{Root}/{workflowTaskId:D}/accrue-survey",
            new AccrueEngineeringSurveyFeeDispatchRequest
            {
                ActorUserId = actorUserId,
                Proposal = proposal,
            },
            cancellationToken);
        return (row, UpstreamJson.FirstError(errors));
    }

    /// <summary>
    /// Forwards the supervisor's decision to Financial with the actor's department scope; Financial
    /// applies the department check.
    /// </summary>
    public async Task<(InspectorFeeRowDto? Row, string? Error)> ResolveDiscountProposalAsync(
        Guid workflowTaskId,
        ResolveDiscountProposalRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var (row, errors) = await PostForResultAsync<InspectorFeeRowDto>(
            $"{Root}/{workflowTaskId:D}/discount-proposal/resolve",
            new ResolveDiscountProposalDispatchRequest
            {
                Decision = request,
                ActorUserId = actorUserId,
                ActorDepartment = actorDepartment,
                CanManageAllDepartments = canManageAllDepartments,
            },
            cancellationToken);
        return (row, UpstreamJson.FirstError(errors));
    }

    /// <summary>
    /// Forwards a whole-transaction cancellation to Financial. The PO is URL-escaped — PO numbers may
    /// contain characters that are not path-safe.
    /// </summary>
    public async Task<(WaivePartyFeesResultDto? Result, string? Error)> WaivePartyFeesAsync(
        string poNumber,
        WaivePartyFeesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var (result, errors) = await PostForResultAsync<WaivePartyFeesResultDto>(
            $"{Root}/transactions/{Uri.EscapeDataString(poNumber.Trim())}/waive-party",
            new WaivePartyFeesDispatchRequest
            {
                Waive = request,
                ActorUserId = actorUserId,
                ActorDepartment = actorDepartment,
                CanManageAllDepartments = canManageAllDepartments,
            },
            cancellationToken);
        return (result, UpstreamJson.FirstError(errors));
    }

    public Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        string? billingStatus = null,
        string? returnTo = null,
        bool hideAwaitingDiscountDecision = false,
        CancellationToken cancellationToken = default,
        string? supervisingDepartment = null)
    {
        var query = $"{Root}?submittedOnly={submittedOnly}"
            + $"&hideAwaitingDiscountDecision={hideAwaitingDiscountDecision}";
        if (!string.IsNullOrWhiteSpace(assigneeId))
            query += $"&assigneeId={Uri.EscapeDataString(assigneeId)}";
        if (!string.IsNullOrWhiteSpace(workflowTaskId))
            query += $"&workflowTaskId={Uri.EscapeDataString(workflowTaskId)}";
        if (!string.IsNullOrWhiteSpace(taskKind))
            query += $"&taskKind={Uri.EscapeDataString(taskKind)}";
        if (!string.IsNullOrWhiteSpace(billingStatus))
            query += $"&billingStatus={Uri.EscapeDataString(billingStatus)}";
        if (!string.IsNullOrWhiteSpace(returnTo))
            query += $"&returnTo={Uri.EscapeDataString(returnTo)}";
        if (!string.IsNullOrWhiteSpace(supervisingDepartment))
            query += $"&supervisingDepartment={Uri.EscapeDataString(supervisingDepartment)}";
        return GetAsync<InspectorFeesSummaryDto>(query, cancellationToken);
    }

    public Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<InspectorFeeRowDto>(
            http,
            httpContext,
            options.Value.FinancialBaseUrl,
            $"{Root}/{workflowTaskId:D}",
            Setting,
            cancellationToken);

    public Task<InspectorFeeRowDto?> PatchAsync(
        Guid workflowTaskId,
        PatchInspectorFeeRequest request,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false) =>
        PostNullableAsync<InspectorFeeRowDto>(
            $"{Root}/{workflowTaskId:D}/patch",
            new InspectorFeePatchDispatchRequest
            {
                Patch = request,
                ActorDepartment = actorDepartment,
                CanManageAllDepartments = canManageAllDepartments,
            },
            cancellationToken);

    public async Task<(InspectorFeeRowDto? Row, string? Error)> TransitionAsync(
        Guid workflowTaskId,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var (row, errors) = await PostForResultAsync<InspectorFeeRowDto>(
            $"{Root}/{workflowTaskId:D}/transition",
            new InspectorFeeTransitionDispatchRequest
            {
                Transition = request,
                ActorUserId = actorUserId,
                ActorAssigneeId = actorAssigneeId,
                IsOperationsManager = isOperationsManager,
                IsFinancialOfficer = isFinancialOfficer,
                ActorDepartment = actorDepartment,
                CanManageAllDepartments = canManageAllDepartments,
            },
            cancellationToken);
        return (row, UpstreamJson.FirstError(errors));
    }

    public Task<BatchInspectorFeeTransitionResponseDto> BatchTransitionAsync(
        BatchInspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false) =>
        SendAsync<BatchInspectorFeeTransitionResponseDto>(
            HttpMethod.Post,
            $"{Root}/batch-transition",
            new InspectorFeeBatchTransitionDispatchRequest
            {
                Batch = request,
                ActorUserId = actorUserId,
                ActorAssigneeId = actorAssigneeId,
                IsOperationsManager = isOperationsManager,
                IsFinancialOfficer = isFinancialOfficer,
                ActorDepartment = actorDepartment,
                CanManageAllDepartments = canManageAllDepartments,
            },
            cancellationToken);


    public async Task<IReadOnlyList<InspectorFeeAuditEntryDto>> ListTransitionsAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<InspectorFeeAuditEntryDto>>(
            $"{Root}/{workflowTaskId:D}/transitions",
            cancellationToken);

    public Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default) =>
        PostAsync(
            $"{Root}/delete-for-tasks",
            new GuidListRequest { Ids = workflowTaskIds.Distinct().ToList() },
            cancellationToken);

    private Task<T> GetAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, path, Setting, cancellationToken);

    private Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken cancellationToken) =>
        UpstreamJson.SendAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, method, path, body, Setting, cancellationToken);

    private async Task<T?> PostNullableAsync<T>(string path, object? body, CancellationToken cancellationToken)
    {
        var (result, _) = await PostForResultAsync<T>(path, body, cancellationToken);
        return result;
    }

    private Task<(T? Result, Dictionary<string, string>? Errors)> PostForResultAsync<T>(
        string path,
        object? body,
        CancellationToken cancellationToken) =>
        UpstreamJson.PostForResultAsync<T>(
            http, httpContext, options.Value.FinancialBaseUrl, path, body, Setting, cancellationToken);

    private Task PostAsync(string path, object? body, CancellationToken cancellationToken) =>
        UpstreamJson.PostAsync(
            http, httpContext, options.Value.FinancialBaseUrl, path, body, Setting, cancellationToken);
}
