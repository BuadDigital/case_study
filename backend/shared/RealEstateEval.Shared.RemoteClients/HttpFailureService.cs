using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Case Study / Operations failure commands. Operator queue stays on the Failures API;
/// system holds and documentary side-effects use authenticated dispatch routes.
/// </summary>
public sealed class HttpFailureService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IFailureService
{
    private const string Setting = "UpstreamServices:FailuresBaseUrl";

    public Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        ListAsync(FailureListQuery.Empty, actor, cancellationToken);

 /// <summary>
 /// The actor is not forwarded: the upstream re-derives it from the bearer header. Filters and
 /// the sort go on the query string, so they are applied where the rows live.
 /// See docs/architecture/pagination-contract.md §5.
 /// </summary>
    public async Task<IReadOnlyList<FailureRecordDto>> ListAsync(
        FailureListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<FailureRecordDto>>(
            "/api/failures" + QueryString(query, paged: false),
            cancellationToken);

    public async Task<PagedResultDto<FailureRecordDto>> ListPagedAsync(
        FailureListQuery query,
        PermissionsDto? actor,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default) =>
        await GetAsync<PagedResultDto<FailureRecordDto>>(
            "/api/failures" + QueryString(query, paged: true),
            cancellationToken);

    private static string QueryString(FailureListQuery query, bool paged)
    {
        var parts = new List<string>();
        void Add(string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                parts.Add($"{name}={Uri.EscapeDataString(value)}");
        }

        if (paged)
        {
            Add("page", (query.Page ?? 1).ToString());
            if (query.PageSize is { } size) Add("pageSize", size.ToString());
        }

        Add("sort", query.Sort);
        Add("dir", query.Dir);
        Add("q", query.Q);
        Add("status", query.Status);
        Add("poNumber", query.PoNumber);
        Add("problemTypeId", query.ProblemTypeId);

        return parts.Count == 0 ? "" : "?" + string.Join("&", parts);
    }

    public Task<FailureRecordDto?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<FailureRecordDto>(
            http,
            httpContext,
            options.Value.FailuresBaseUrl,
            $"/api/failures/property?poNumber={Uri.EscapeDataString(poNumber)}&propertyId={Uri.EscapeDataString(propertyId)}",
            Setting,
            cancellationToken);

    public Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateFailureRequest request,
        CancellationToken cancellationToken = default) =>
        PostForResultAsync<FailureRecordDto>("/api/failures", request, cancellationToken);

    public Task<(FailureRecordDto? Result, Dictionary<string, string>? Errors)> ReportBourseObstructionAsync(
        BourseObstructionRequest request,
        CancellationToken cancellationToken = default) =>
        PostForResultAsync<FailureRecordDto>("/api/failures/bourse-obstruction", request, cancellationToken);

    public Task<FailureRecordDto?> EnsureSystemInternalFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string problemTypeId,
        string title,
        string note,
        string specialist,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>(
            "/api/failure-dispatch/ensure-system-internal",
            new EnsureSystemInternalFailureRequest
            {
                PoNumber = poNumber,
                PropertyId = propertyId,
                DeedNumber = deedNumber,
                ProblemTypeId = problemTypeId,
                Title = title,
                Note = note,
                Specialist = specialist,
            },
            cancellationToken);

    public Task ApplyEvictionHoldAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default) =>
        PostAsync(
            "/api/failure-dispatch/eviction-hold",
            new PropertyFailureHoldRequest
            {
                PoNumber = poNumber,
                PropertyId = propertyId,
                DeedNumber = deedNumber,
                Specialist = specialist,
            },
            cancellationToken);

    public Task ResolveEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string actor,
        CancellationToken cancellationToken = default) =>
        PostAsync(
            "/api/failure-dispatch/eviction-hold/resolve",
            new ResolveEvictionHoldRequest
            {
                PoNumber = poNumber,
                PropertyId = propertyId,
                Actor = actor,
            },
            cancellationToken);

    public Task EnsureKeyUnmatchedFailureAsync(
        string poNumber,
        string propertyId,
        string deedNumber,
        string specialist,
        CancellationToken cancellationToken = default) =>
        PostAsync(
            "/api/failure-dispatch/key-unmatched",
            new PropertyFailureHoldRequest
            {
                PoNumber = poNumber,
                PropertyId = propertyId,
                DeedNumber = deedNumber,
                Specialist = specialist,
            },
            cancellationToken);

    public Task<FailureRecordDto?> UpgradeToInternalAsync(
        Guid id,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>($"/api/failures/{id:D}/upgrade", null, cancellationToken);

    public Task<FailureRecordDto?> SubmitForReviewAsync(
        Guid id,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>($"/api/failures/{id:D}/submit", null, cancellationToken);

    public Task<FailureRecordDto?> SuspendAsync(
        Guid id,
        string note,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>(
            $"/api/failures/{id:D}/suspend",
            new FailureNoteRequest { Note = note },
            cancellationToken);

    public Task<FailureRecordDto?> ResolveAsync(
        Guid id,
        ResolveFailureRequest request,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>(
            $"/api/failure-dispatch/{id:D}/resolve",
            request,
            cancellationToken);

    public Task<FailureRecordDto?> ApproveAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>(
            $"/api/failures/{id:D}/approve",
            new FailureNoteRequest { Note = finalNote },
            cancellationToken);

    public Task<FailureRecordDto?> ReturnAsync(
        Guid id,
        string finalNote,
        CancellationToken cancellationToken = default) =>
        PostNullableAsync<FailureRecordDto>(
            $"/api/failures/{id:D}/return",
            new FailureNoteRequest { Note = finalNote },
            cancellationToken);

    public Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default) =>
        UpstreamJson.DeleteAsync(
            http,
            httpContext,
            options.Value.FailuresBaseUrl,
            $"/api/failures/by-po/{Uri.EscapeDataString(poNumber)}",
            Setting,
            cancellationToken);

    private Task<T> GetAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetAsync<T>(
            http,
            httpContext,
            options.Value.FailuresBaseUrl,
            path,
            Setting,
            cancellationToken);

    private async Task<T?> PostNullableAsync<T>(
        string path,
        object? body,
        CancellationToken cancellationToken)
    {
        var (result, _) = await PostForResultAsync<T>(path, body, cancellationToken);
        return result;
    }

    private Task<(T? Result, Dictionary<string, string>? Errors)> PostForResultAsync<T>(
        string path,
        object? body,
        CancellationToken cancellationToken) =>
        UpstreamJson.PostForResultAsync<T>(
            http,
            httpContext,
            options.Value.FailuresBaseUrl,
            path,
            body,
            Setting,
            cancellationToken);

    private Task PostAsync(string path, object? body, CancellationToken cancellationToken) =>
        UpstreamJson.PostAsync(
            http,
            httpContext,
            options.Value.FailuresBaseUrl,
            path,
            body,
            Setting,
            cancellationToken);
}
