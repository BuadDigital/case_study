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

    /// <summary>
    /// Review voids the appraiser's approval before a return (Omar 2026-11-18): POST
    /// <c>by-property/{id}/withdraw-approval-for-return</c> with the reviewer's bearer.
    /// </summary>
    /// <remarks>
    /// How it works: a 2xx (204 when there is no open request) is success → null; a 400 brings the owner's
    /// Arabic refusal (a recorded deposit code); 403 and transport failures become fixed Arabic messages.
    /// Edge cases: the return must not go on when this fails, so every failure is a message, never a throw.
    /// </remarks>
    public async Task<string?> WithdrawApprovalForReturnAsync(
        Guid propertyId,
        string note,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var (_, errors) = await UpstreamJson.PostForResultAsync<object>(
                http,
                httpContext,
                options.Value.ValuationBaseUrl,
                $"/api/valuation-report-drafts/by-property/{propertyId:D}/withdraw-approval-for-return",
                new WithdrawBody { Note = note },
                Setting,
                cancellationToken);
            return errors is { Count: > 0 }
                ? UpstreamJson.FirstError(errors) ?? "تعذّر إلغاء اعتماد المقيّم."
                : null;
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            return "إلغاء اعتماد المقيّم عند الإرجاع للمراجع فقط.";
        }
        catch (HttpRequestException)
        {
            return "تعذّر الوصول لخدمة التقييم لإلغاء اعتماد المقيّم — أعد المحاولة.";
        }
    }

    private sealed class WithdrawBody
    {
        public string Note { get; set; } = "";
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
