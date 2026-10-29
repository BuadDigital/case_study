using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Case Study → Operations dispatch: records a cancelled (or reactivated) transaction in the key envelopes.</summary>
public sealed class HttpKeyEnvelopePropertyCancellation(
    HttpClient http,
    IHttpContextAccessor httpContext,
    IOptions<UpstreamServicesOptions> options) : IKeyEnvelopePropertyCancellation
{
    private const string Setting = "UpstreamServices:OperationsBaseUrl";

    public Task SetPropertiesCancelledAsync(
        IReadOnlyList<Guid> propertyIds,
        bool cancelled,
        string actorName,
        CancellationToken cancellationToken = default) =>
        UpstreamJson.PostAsync(
            http,
            httpContext,
            options.Value.OperationsBaseUrl,
            "/api/key-envelope-dispatch/properties-cancelled",
            new SetKeyPropertiesCancelledRequest
            {
                PropertyIds = propertyIds.ToList(),
                Cancelled = cancelled,
                Actor = actorName,
            },
            Setting,
            cancellationToken);
}
