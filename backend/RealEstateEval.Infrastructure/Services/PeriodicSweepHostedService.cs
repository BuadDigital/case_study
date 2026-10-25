using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// A background sweep: waits <see cref="InitialDelay"/> after start-up, then runs one pass in
/// its own DI scope every <see cref="Interval"/>. A failed pass is logged and the next one still
/// runs; shutdown during a wait ends the loop quietly.
/// </summary>
public abstract class PeriodicSweepHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    protected PeriodicSweepHostedService(IServiceScopeFactory scopeFactory, ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected abstract TimeSpan InitialDelay { get; }

    protected abstract TimeSpan Interval { get; }

 /// <summary>Names the pass in the failure log, e.g. "Property keys projection sweep".</summary>
    protected abstract string SweepName { get; }

    protected abstract Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken);

    protected sealed override async Task ExecuteAsync(CancellationToken stoppingToken)
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
                await SweepAsync(scope.ServiceProvider, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "{Sweep} failed", SweepName);
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
