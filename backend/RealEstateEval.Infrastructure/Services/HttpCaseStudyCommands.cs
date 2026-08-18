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
            return (null, errors.Values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "تعذر إنشاء المرجع.");
        var reference = body?.Reference?.Trim();
        return string.IsNullOrWhiteSpace(reference) ? (null, "تعذر إنشاء المرجع.") : (reference, null);
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
}
