using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Infrastructure.Services;

/// <summary>
/// Envelope/legacy → property-key projection used to run inside every list read,
/// re-projecting all envelopes and possibly writing per screen poll. A short
/// interval keeps the keys screen fresh after envelope confirmations.
/// </summary>
public sealed class PropertyKeysProjectionHostedService : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PropertyKeysProjectionHostedService> _logger;

    public PropertyKeysProjectionHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<PropertyKeysProjectionHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(InitialDelay, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var keys = scope.ServiceProvider.GetRequiredService<IPropertyKeysService>();
                await keys.SyncProjectionAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Property keys projection sweep failed");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
