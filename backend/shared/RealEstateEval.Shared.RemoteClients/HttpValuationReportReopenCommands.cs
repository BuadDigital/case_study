using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Case-study-host HTTP client for the valuation report's new-version reopen.</summary>
public sealed class HttpValuationReportReopenCommands(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IValuationReportReopenCommands
{
    private const string Setting = "UpstreamServices:ValuationBaseUrl";

    public async Task<(bool Reopened, string? Error)> ReopenDepositedReportAsync(
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (body, errors) = await UpstreamJson.PostForResultAsync<ReopenAckDto>(
                http,
                httpContext,
                options.Value.ValuationBaseUrl,
                $"/api/valuation-report-drafts/by-property/{propertyId:D}/reopen-version",
                new ReopenBody { Reason = reason },
                Setting,
                cancellationToken);
            if (errors is { Count: > 0 })
            {
                return (false, errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))
                    ?? "تعذّر فتح تقرير التقييم بنسخة جديدة.");
            }

            return body is null ? (false, "لا تقرير مودَع لهذا العقار.") : (true, null);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            return (false, "فتح تقرير التقييم بنسخة جديدة للأخصائي فقط.");
        }
        catch (HttpRequestException)
        {
            return (false, "تعذّر الوصول لخدمة التقييم لفتح التقرير بنسخة جديدة — أعد المحاولة.");
        }
    }

    private sealed class ReopenBody
    {
        public string Reason { get; set; } = "";
    }

    private sealed class ReopenAckDto
    {
        public int Version { get; set; }
    }
}
