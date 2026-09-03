using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateEval.Financial.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Ledger backfill + task-snapshot sync used to run inside every fee-summary read,
/// loading all ledgers (tracked) and all their tasks per screen poll. The event
/// path (EnsureLedgersForTasksAsync) creates rows promptly; this loop is the
/// safety net for missed events and drifted snapshots.
/// </summary>
public sealed class InspectorFeeLedgerMaintenanceHostedService : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InspectorFeeLedgerMaintenanceHostedService> _logger;

    public InspectorFeeLedgerMaintenanceHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<InspectorFeeLedgerMaintenanceHostedService> logger)
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
                var writer = scope.ServiceProvider
                    .GetRequiredService<IInspectorFeeLedgerWriter>();
                await writer.BackfillMissingLedgersAsync(stoppingToken);
                await writer.SyncLedgerSnapshotsFromTasksAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Inspector fee ledger maintenance sweep failed");
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
