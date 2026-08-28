using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class HttpPropertyKeysService(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IPropertyKeysService
{
    private const string Setting = "UpstreamServices:OperationsBaseUrl";

    public async Task<IReadOnlyList<PropertyKeyRecordDto>> ListAsync(
        bool? hasKey,
        CancellationToken cancellationToken = default)
    {
        var path = hasKey is null
            ? "/api/property-keys"
            : $"/api/property-keys?hasKey={hasKey.Value.ToString().ToLowerInvariant()}";
        var list = await UpstreamJson.GetAsync<List<PropertyKeyRecordDto>>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            path,
            Setting,
            cancellationToken);
        return list;
    }

    // الإسقاط شأن خدمة العمليات وحدها (حلقة الصيانة هناك) — لا مسار بعيد له.
    public Task SyncProjectionAsync(CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<PropertyKeyRecordDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.GetOrDefaultAsync<PropertyKeyRecordDto>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            $"/api/property-keys/{id:D}",
            Setting,
            cancellationToken);

    public async Task<PropertyKeyRecordDto?> PatchAsync(
        Guid id,
        UpdatePropertyKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var (result, _) = await UpstreamJson.SendForResultAsync<PropertyKeyRecordDto>(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            HttpMethod.Patch,
            $"/api/property-keys/{id:D}",
            request,
            Setting,
            cancellationToken);
        return result;
    }
}
