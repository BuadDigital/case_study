using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Case Study dispatch uses create + open-by-property. Other methods belong on the Valuation host.
/// </summary>
public sealed class HttpValuationRequestService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IValuationRequestService
{
    public Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("List valuation requests on the Valuation API.");

    public Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<ValuationRequestDto>(
            http,
            httpContext,
            options.Value.ValuationBaseUrl,
            $"/api/valuation-requests/{id:D}",
            "UpstreamServices:ValuationBaseUrl",
            cancellationToken);

    public Task<ValuationRequestDto?> GetOpenByPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<ValuationRequestDto>(
            http,
            httpContext,
            options.Value.ValuationBaseUrl,
            $"/api/valuation-request-dispatch/open-by-property/{Uri.EscapeDataString(propertyId)}",
            "UpstreamServices:ValuationBaseUrl",
            cancellationToken);

    public async Task<(ValuationRequestDto? Result, string? Error)> CreateAsync(
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var created = await UpstreamJson.SendAsync<ValuationRequestDto>(
                http,
                httpContext,
                options.Value.ValuationBaseUrl,
                HttpMethod.Post,
                "/api/valuation-request-dispatch",
                request,
                "UpstreamServices:ValuationBaseUrl",
                cancellationToken);
            return (created, null);
        }
        catch (UpstreamConflictException ex)
        {
            return (null, MapConflict(ex.Error));
        }
    }

    public Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
        Guid id,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Submit valuation reports on the Valuation API.");

    public Task<(ValuationRequestDto? Result, string? Error)> RecordImpedimentAsync(
        Guid id,
        ValuationImpedimentRequest request,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Record valuation impediments on the Valuation API.");

    private static string MapConflict(string error) =>
        error.Contains("open", StringComparison.OrdinalIgnoreCase)
            ? "valuation_already_open"
            : error.Contains("display", StringComparison.OrdinalIgnoreCase)
                ? "duplicate_display_id"
                : error;
}
