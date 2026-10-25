using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Infrastructure.Services;

/// <summary>
/// Envelope/legacy → property-key projection used to run inside every list read,
/// re-projecting all envelopes and possibly writing per screen poll. A short
/// interval keeps the keys screen fresh after envelope confirmations.
/// </summary>
public sealed class PropertyKeysProjectionHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<PropertyKeysProjectionHostedService> logger)
    : PeriodicSweepHostedService(scopeFactory, logger)
{
    protected override TimeSpan InitialDelay { get; } = TimeSpan.FromSeconds(15);

    protected override TimeSpan Interval { get; } = TimeSpan.FromSeconds(60);

    protected override string SweepName => "Property keys projection sweep";

    protected override Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken) =>
        services.GetRequiredService<IPropertyKeysService>().SyncProjectionAsync(cancellationToken);
}
