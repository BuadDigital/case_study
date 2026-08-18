using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpFailureLookup(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IFailureLookup
{
    private const string Setting = "UpstreamServices:FailuresBaseUrl";

    public async Task<bool> HasActiveAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var gates = await GatesAsync(poNumber, propertyId, cancellationToken);
        return gates.HasActive;
    }

    public async Task<bool> HasBlockingAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var gates = await GatesAsync(poNumber, propertyId, cancellationToken);
        return gates.HasBlocking;
    }

    public async Task<IReadOnlyList<string>> ListApprovedPropertyKeysAsync(
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<string>>("/api/failure-dispatch/approved-keys", cancellationToken);

    public async Task<IReadOnlyList<FailureRecordDto>> ListForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<FailureRecordDto>>(
            $"/api/failure-dispatch/property?poNumber={Uri.EscapeDataString(poNumber)}&propertyId={Uri.EscapeDataString(propertyId)}",
            cancellationToken);

    public async Task<IReadOnlyList<FailureRecordDto>> ListSuspendedAsync(
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<FailureRecordDto>>("/api/failure-dispatch/suspended", cancellationToken);

    public async Task<IReadOnlyList<Guid>> ListActiveIdsByProblemAsync(
        string poNumber,
        string propertyId,
        string problemTypeId,
        string raisedByRole,
        CancellationToken cancellationToken = default) =>
        await GetAsync<List<Guid>>(
            "/api/failure-dispatch/active-ids"
            + $"?poNumber={Uri.EscapeDataString(poNumber)}"
            + $"&propertyId={Uri.EscapeDataString(propertyId)}"
            + $"&problemTypeId={Uri.EscapeDataString(problemTypeId)}"
            + $"&raisedByRole={Uri.EscapeDataString(raisedByRole)}",
            cancellationToken);

    private async Task<FailurePropertyGatesDto> GatesAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken) =>
        await GetAsync<FailurePropertyGatesDto>(
            $"/api/failure-dispatch/gates?poNumber={Uri.EscapeDataString(poNumber)}&propertyId={Uri.EscapeDataString(propertyId)}",
            cancellationToken);

    private Task<T> GetAsync<T>(string path, CancellationToken cancellationToken) =>
        UpstreamJson.GetAsync<T>(
            http,
            httpContext,
            options.Value.FailuresBaseUrl,
            path,
            Setting,
            cancellationToken);
}
