using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Case Study key-availability gates. Operator <c>/api/key-envelopes/gate</c> keeps ReadKeyData;
/// CS billing/inspection actors use authenticated dispatch.
/// </summary>
public sealed class HttpPropertyKeyGateResolver(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPropertyKeyGateResolver
{
    private const string Setting = "UpstreamServices:OperationsBaseUrl";

    public Task<PropertyKeyGateDto> ResolveAsync(
        Guid? propertyId,
        string? poNumber,
        string? deedNumber,
        string? requestNumber,
        CancellationToken cancellationToken = default)
    {
        var qs = new List<string>();
        if (propertyId is Guid id)
            qs.Add($"propertyId={Uri.EscapeDataString(id.ToString("D"))}");
        if (!string.IsNullOrWhiteSpace(poNumber))
            qs.Add($"poNumber={Uri.EscapeDataString(poNumber.Trim())}");
        if (!string.IsNullOrWhiteSpace(deedNumber))
            qs.Add($"deedNumber={Uri.EscapeDataString(deedNumber.Trim())}");
        if (!string.IsNullOrWhiteSpace(requestNumber))
            qs.Add($"requestNumber={Uri.EscapeDataString(requestNumber.Trim())}");

        var path = "/api/key-envelope-dispatch/gate"
            + (qs.Count > 0 ? "?" + string.Join("&", qs) : "");
        return UpstreamJson.GetAsync<PropertyKeyGateDto>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            path,
            Setting,
            cancellationToken);
    }
}
