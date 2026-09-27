using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpCaseStudyLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ICaseStudyLookup
{
    private const string Setting = "UpstreamServices:CaseStudyBaseUrl";

    public Task<IReadOnlyList<Guid>> ListCompletedCaseStudyPropertyIdsAsync(
        CancellationToken cancellationToken = default) =>
        GetListAsync<Guid>("/api/case-study-dispatch/completed-case-study-property-ids", cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, WorkflowTaskKind>> GetWorkflowTaskKindsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default)
    {
        var map = new Dictionary<Guid, WorkflowTaskKind>();
        foreach (var chunk in QueryIdBatch.OfGuids(taskIds))
        {
            var items = await GetListAsync<CaseStudyWorkflowTaskKindDto>(
                $"/api/case-study-dispatch/workflow-task-kinds?ids={QueryIdBatch.JoinEscaped(chunk)}",
                cancellationToken);
            foreach (var item in items)
            {
                if (Enum.TryParse<WorkflowTaskKind>(item.Kind, ignoreCase: true, out var kind))
                    map.TryAdd(item.Id, kind);
            }
        }

        return map;
    }

    public Task<IReadOnlyList<CaseStudyWorkOrderSummaryDto>> ListWorkOrderSummariesAsync(
        CancellationToken cancellationToken = default) =>
        GetListAsync<CaseStudyWorkOrderSummaryDto>(
            "/api/case-study-dispatch/work-order-summaries",
            cancellationToken);

    public Task<CaseStudyPropertySnapshotDto?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default) =>
        GetOrDefaultAsync<CaseStudyPropertySnapshotDto>(
            $"/api/case-study-dispatch/properties/{propertyId:D}",
            cancellationToken);

    public Task<IReadOnlyList<string>> ListPoNumbersByAssigneesAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default) =>
        GetListByStringQueryAsync<string>(
            "/api/case-study-dispatch/po-numbers-by-assignee?ids=",
            assigneeIds,
            cancellationToken);

    public Task<CaseStudyValuationPropertyContextDto?> GetValuationPropertyContextAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default) =>
        GetOrDefaultAsync<CaseStudyValuationPropertyContextDto>(
            $"/api/case-study-dispatch/valuation-property-context/{propertyId:D}",
            cancellationToken);

    public Task<CaseStudyPropertySnapshotDto?> GetPropertyByPoAndDeedAsync(
        string poNumber,
        string deedNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var deed = deedNumber.Trim();
        if (po.Length == 0 || deed.Length == 0)
            return Task.FromResult<CaseStudyPropertySnapshotDto?>(null);

        return GetOrDefaultAsync<CaseStudyPropertySnapshotDto>(
            "/api/case-study-dispatch/properties"
            + $"?poNumber={Uri.EscapeDataString(po)}"
            + $"&deedNumber={Uri.EscapeDataString(deed)}",
            cancellationToken);
    }

    public Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default) =>
        GetListByStringQueryAsync<CaseStudyPropertySnapshotDto>(
            "/api/case-study-dispatch/properties-by-po?poNumbers=",
            poNumbers,
            cancellationToken);

    public Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByRequestNumbersAsync(
        IReadOnlyList<string> requestNumbers,
        CancellationToken cancellationToken = default) =>
        GetListByStringQueryAsync<CaseStudyPropertySnapshotDto>(
            "/api/case-study-dispatch/properties-by-request?requestNumbers=",
            requestNumbers,
            cancellationToken);

    public async Task<string?> GetCaseSpecialistAssigneeAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var body = await GetOrDefaultAsync<CaseStudyAssigneeDto>(
            $"/api/case-study-dispatch/case-specialist-assignee?propertyId={propertyId:D}",
            cancellationToken);
        return string.IsNullOrWhiteSpace(body?.AssigneeId) ? null : body.AssigneeId;
    }

    public Task<IReadOnlyList<CaseStudyGovReviewKeyStatusDto>> ListGovReviewKeyStatusesAsync(
        CancellationToken cancellationToken = default) =>
        GetListAsync<CaseStudyGovReviewKeyStatusDto>(
            "/api/case-study-dispatch/gov-review-key-statuses",
            cancellationToken);

    public Task<IReadOnlyList<CaseStudyPropertySnapshotDto>> ListPropertiesByIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default) =>
        GetListByGuidQueryAsync<CaseStudyPropertySnapshotDto>(
            "/api/case-study-dispatch/properties-by-id?ids=",
            propertyIds,
            cancellationToken);

    public Task<CaseStudyWorkflowTaskSnapshotDto?> GetWorkflowTaskAsync(
        Guid taskId,
        CancellationToken cancellationToken = default) =>
        GetOrDefaultAsync<CaseStudyWorkflowTaskSnapshotDto>(
            $"/api/case-study-dispatch/workflow-tasks/{taskId:D}",
            cancellationToken);

    public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByIdsAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken = default) =>
        GetListByGuidQueryAsync<CaseStudyWorkflowTaskSnapshotDto>(
            "/api/case-study-dispatch/workflow-tasks?ids=",
            taskIds,
            cancellationToken);

    public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPropertyAsync(
        Guid propertyId,
        IReadOnlyList<WorkflowTaskKind>? kinds = null,
        CancellationToken cancellationToken = default)
    {
        var path = $"/api/case-study-dispatch/workflow-tasks-by-property?propertyId={propertyId:D}";
        if (kinds is { Count: > 0 })
            path += $"&kinds={Uri.EscapeDataString(JoinKinds(kinds))}";
        return GetListAsync<CaseStudyWorkflowTaskSnapshotDto>(path, cancellationToken);
    }

    public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByKindsAsync(
        IReadOnlyList<WorkflowTaskKind> kinds,
        CancellationToken cancellationToken = default)
    {
        if (kinds.Count == 0)
            return Task.FromResult<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>>([]);

        return GetListAsync<CaseStudyWorkflowTaskSnapshotDto>(
            $"/api/case-study-dispatch/workflow-tasks-by-kind?kinds={Uri.EscapeDataString(JoinKinds(kinds))}",
            cancellationToken);
    }

    public Task<IReadOnlyList<CaseStudyWorkflowTaskSnapshotDto>> ListWorkflowTasksByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default) =>
        GetListByStringQueryAsync<CaseStudyWorkflowTaskSnapshotDto>(
            "/api/case-study-dispatch/workflow-tasks-by-po?poNumbers=",
            poNumbers,
            cancellationToken);

    public Task<IReadOnlyList<CaseStudyPartyTaskSubmissionSnapshotDto>> ListPartyTaskSubmissionsByTaskIdsAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default) =>
        GetListByGuidQueryAsync<CaseStudyPartyTaskSubmissionSnapshotDto>(
            "/api/case-study-dispatch/party-task-submissions?ids=",
            workflowTaskIds,
            cancellationToken);

    public Task<IReadOnlyList<CaseStudyFieldInspectionWorkspaceSnapshotDto>> ListFieldInspectionWorkspacesByTaskIdsAsync(
        IReadOnlyList<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default) =>
        GetListByGuidQueryAsync<CaseStudyFieldInspectionWorkspaceSnapshotDto>(
            "/api/case-study-dispatch/field-inspection-workspaces?ids=",
            workflowTaskIds,
            cancellationToken);

    public async Task<Guid?> GetWorkOrderIdByPoNumberAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0)
            return null;

        var body = await GetOrDefaultAsync<CaseStudyWorkOrderIdDto>(
            $"/api/case-study-dispatch/work-order-id?poNumber={Uri.EscapeDataString(po)}",
            cancellationToken);
        return body?.Id;
    }

    public async Task<IReadOnlyDictionary<string, DateTime?>> GetWorkOrderReceivedAtByPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        var map = new Dictionary<string, DateTime?>(StringComparer.Ordinal);
        var rows = await GetListByStringQueryAsync<CaseStudyWorkOrderReceivedAtDto>(
            "/api/case-study-dispatch/work-order-received-at?poNumbers=",
            poNumbers,
            cancellationToken);
        foreach (var row in rows)
            map.TryAdd(row.PoNumber.Trim(), row.ReceivedFromEnfathAtUtc);
        return map;
    }

    public Task<IReadOnlyList<CaseStudyWorkOrderBillingSnapshotDto>> ListWorkOrdersForBillingAsync(
        int take,
        CancellationToken cancellationToken = default) =>
        GetListAsync<CaseStudyWorkOrderBillingSnapshotDto>(
            $"/api/case-study-dispatch/work-orders-for-billing?take={Math.Clamp(take, 1, 500)}",
            cancellationToken);

    public Task<CaseStudyWorkOrderBillingSnapshotDto?> GetWorkOrderForBillingAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0)
            return Task.FromResult<CaseStudyWorkOrderBillingSnapshotDto?>(null);

        return GetOrDefaultAsync<CaseStudyWorkOrderBillingSnapshotDto>(
            $"/api/case-study-dispatch/work-orders-for-billing/{Uri.EscapeDataString(po)}",
            cancellationToken);
    }

    private static string JoinKinds(IReadOnlyList<WorkflowTaskKind> kinds) =>
        string.Join(",", kinds.Select(k => k.ToDbValue()));

    private async Task<IReadOnlyList<T>> GetListByGuidQueryAsync<T>(
        string pathBeforeIds,
        IReadOnlyList<Guid> ids,
        CancellationToken cancellationToken)
    {
        var chunks = QueryIdBatch.OfGuids(ids);
        if (chunks.Count == 0)
            return [];
        if (chunks.Count == 1)
            return await GetListAsync<T>(
                pathBeforeIds + QueryIdBatch.JoinEscaped(chunks[0]),
                cancellationToken);

        var all = new List<T>();
        foreach (var chunk in chunks)
        {
            all.AddRange(await GetListAsync<T>(
                pathBeforeIds + QueryIdBatch.JoinEscaped(chunk),
                cancellationToken));
        }

        return all;
    }

    private async Task<IReadOnlyList<T>> GetListByStringQueryAsync<T>(
        string pathBeforeIds,
        IEnumerable<string?> values,
        CancellationToken cancellationToken)
    {
        var chunks = QueryIdBatch.OfStrings(values);
        if (chunks.Count == 0)
            return [];
        if (chunks.Count == 1)
            return await GetListAsync<T>(
                pathBeforeIds + QueryIdBatch.JoinEscaped(chunks[0]),
                cancellationToken);

        var all = new List<T>();
        foreach (var chunk in chunks)
        {
            all.AddRange(await GetListAsync<T>(
                pathBeforeIds + QueryIdBatch.JoinEscaped(chunk),
                cancellationToken));
        }

        return all;
    }

    private async Task<IReadOnlyList<T>> GetListAsync<T>(string path, CancellationToken cancellationToken)
    {
        var list = await UpstreamJson.GetAsync<List<T>>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            path,
            Setting,
            cancellationToken);
        return list;
    }

    private Task<T?> GetOrDefaultAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetOrDefaultAsync<T>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            path,
            Setting,
            cancellationToken);
}
