using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Valuation-host HTTP client for the trusted recall-reopen route of Case Study.</summary>
public sealed class HttpCaseStudyRecallCommands(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : ICaseStudyRecallCommands
{
    private const string Setting = "UpstreamServices:CaseStudyBaseUrl";

    public async Task<(bool Reopened, string? Error)> ReopenAppraisalForRecallAsync(
        Guid appraisalTaskId,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var (body, errors) = await UpstreamJson.PostForResultAsync<RecallReopenAckDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            $"/api/case-study-dispatch/party-submissions/{appraisalTaskId:D}/reopen-for-recall",
            new RecallReopenBody { Reason = reason },
            Setting,
            cancellationToken);
        if (errors is { Count: > 0 })
        {
            return (false, errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))
                ?? "تعذر إعادة فتح تقييم العقار.");
        }

        return body is null ? (false, "مهمة التقييم غير موجودة.") : (true, null);
    }

    public async Task<(bool Reopened, string? Error)> ReopenAppraisalForNewVersionAsync(
        Guid appraisalTaskId,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var (body, errors) = await UpstreamJson.PostForResultAsync<RecallReopenAckDto>(
            http,
            httpContext,
            options.Value.CaseStudyBaseUrl,
            $"/api/case-study-dispatch/party-submissions/{appraisalTaskId:D}/reopen-for-new-version",
            new RecallReopenBody { Reason = reason },
            Setting,
            cancellationToken);
        if (errors is { Count: > 0 })
        {
            return (false, errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))
                ?? "تعذر إعادة فتح تقييم العقار بنسخة جديدة.");
        }

        return body is null ? (false, "مهمة التقييم غير موجودة.") : (true, null);
    }

    private sealed class RecallReopenBody
    {
        public string? Reason { get; set; }
    }

    private sealed class RecallReopenAckDto
    {
        public string? Status { get; set; }
    }
}
