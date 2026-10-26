using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpCaseStudyCommands(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ICaseStudyCommands
{
    private const string Setting = "UpstreamServices:CaseStudyBaseUrl";

    public async Task<(string? Reference, string? Error)> AllocateDocumentReferenceAsync(
        string dept,
        string type,
        string dateKey,
        CancellationToken cancellationToken = default)
    {
        var (body, errors) = await UpstreamJson.PostForResultAsync<CaseStudyDocumentReferenceDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            "/api/case-study-dispatch/document-references",
            new AllocateCaseStudyDocumentReferenceRequest
            {
                Dept = dept,
                Type = type,
                DateKey = dateKey,
            },
            Setting,
            cancellationToken);
        if (errors is { Count: > 0 })
            return (null, errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "تعذّر إنشاء المرجع.");
        var reference = body?.Reference?.Trim();
        return string.IsNullOrWhiteSpace(reference) ? (null, "تعذّر إنشاء المرجع.") : (reference, null);
    }

    public Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.PostAsync(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            $"/api/case-study-dispatch/properties/{propertyId:D}/backfill-area",
            new BackfillCaseStudyPropertyAreaRequest { AreaM2 = areaM2 },
            Setting,
            cancellationToken);

    /// <summary>
    /// Decision 2026-10-19: asks Case Study to fix the deed's transaction PR reference (drawn now if missing)
    /// and returns the numbers derived from it (PRV for the report).
    /// </summary>
    /// <remarks>
    /// How it works: POSTs an empty body to /api/case-study-dispatch/properties/{propertyId}/confirm-reference
    /// through <c>UpstreamJson.PostForResultAsync</c>; returns (numbers, null) on success.
    /// Edge cases: a problem answer returns its first non-blank message (or «تعذّر تثبيت الرقم المرجعي.»); a
    /// success whose ReferenceNumber is empty also counts as a failure, so a report number is never taken
    /// from a transaction without its official PR. Case Study confirms idempotently, so a retry never draws
    /// a second PR.
    /// </remarks>
    public async Task<(CaseStudyTransactionNumbersDto? Result, string? Error)> ConfirmTransactionReferenceAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var (body, errors) = await UpstreamJson.PostForResultAsync<CaseStudyTransactionNumbersDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            $"/api/case-study-dispatch/properties/{propertyId:D}/confirm-reference",
            new { },
            Setting,
            cancellationToken);
        if (errors is { Count: > 0 })
            return (null, errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "تعذّر تثبيت الرقم المرجعي.");
        return string.IsNullOrWhiteSpace(body?.ReferenceNumber)
            ? (null, "تعذّر تثبيت الرقم المرجعي.")
            : (body, null);
    }
}

/// <summary>Failures-host HTTP client for the Case Study failure side effects (A9).</summary>
public sealed class HttpCaseStudyFailureCommands(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ICaseStudyFailureCommands
{
    private const string Setting = "UpstreamServices:CaseStudyBaseUrl";

    public Task SetFailureDeedStatusAsync(
        SetCaseStudyDeedStatusRequest request,
        CancellationToken cancellationToken = default) =>
        PostCommandAsync("/api/case-study-dispatch/properties/deed-status", request, cancellationToken);

    public Task EscalateObstructionAsync(
        EscalateCaseStudyObstructionRequest request,
        CancellationToken cancellationToken = default) =>
        PostCommandAsync(
            "/api/case-study-dispatch/case-study-tasks/escalate-obstruction",
            request,
            cancellationToken);

    public Task ResolveObstructionAsync(
        ResolveCaseStudyObstructionRequest request,
        CancellationToken cancellationToken = default) =>
        PostCommandAsync(
            "/api/case-study-dispatch/case-study-tasks/resolve-obstruction",
            request,
            cancellationToken);

    public Task BlockPropertyTasksForFailureAsync(
        BlockCaseStudyTasksForFailureRequest request,
        CancellationToken cancellationToken = default) =>
        PostCommandAsync(
            "/api/case-study-dispatch/case-study-tasks/block-for-approved-failure",
            request,
            cancellationToken);

    public async Task<CaseStudyHoldTaskResultDto?> BlockTaskForHoldAsync(
        CaseStudyHoldTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var (result, _) = await UpstreamJson.PostForResultAsync<CaseStudyHoldTaskResultDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            "/api/case-study-dispatch/case-study-tasks/block-for-hold",
            request,
            Setting,
            cancellationToken);
        return result;
    }

    public async Task<CaseStudyHoldTaskResultDto?> UnblockTaskForHoldAsync(
        CaseStudyHoldTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var (result, _) = await UpstreamJson.PostForResultAsync<CaseStudyHoldTaskResultDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            "/api/case-study-dispatch/case-study-tasks/unblock-for-hold",
            request,
            Setting,
            cancellationToken);
        return result;
    }

    public Task RecordPropertyTimelineEventAsync(
        PropertyTimelineRecordRequest request,
        CancellationToken cancellationToken = default) =>
        PostCommandAsync(
            "/api/case-study-dispatch/property-timeline/record",
            request,
            cancellationToken);

    private Task PostCommandAsync(string path, object body, CancellationToken cancellationToken) =>
        UpstreamJson.PostAsync(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            path,
            body,
            Setting,
            cancellationToken);
}
