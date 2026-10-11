using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Posts a timeline milestone to Case Study's dispatch route; a failure is logged and swallowed.</summary>
public sealed class HttpPropertyTimelineRecorder(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options,
    ILogger<HttpPropertyTimelineRecorder> logger) : IPropertyTimelineRecorder
{
    private const string Setting = "UpstreamServices:CaseStudyBaseUrl";

    public async Task RecordAsync(
        PropertyTimelineRecordRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await UpstreamJson.PostAsync(
                http,
                httpContext,
                options.Value.CaseStudyBaseUrl,
                "/api/case-study-dispatch/property-timeline/record",
                request,
                Setting,
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Property timeline milestone {EventKey} was not recorded.", request.EventKey);
        }
    }
}
