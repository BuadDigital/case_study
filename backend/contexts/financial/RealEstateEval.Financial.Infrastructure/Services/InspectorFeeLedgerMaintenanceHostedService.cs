using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Ledger backfill + task-snapshot sync used to run inside every fee-summary read,
/// loading all ledgers (tracked) and all their tasks per screen poll. The event
/// path (EnsureLedgersForTasksAsync) creates rows promptly; this loop is the
/// safety net for missed events and drifted snapshots.
/// </summary>
public sealed class InspectorFeeLedgerMaintenanceHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<InspectorFeeLedgerMaintenanceHostedService> logger)
    : PeriodicSweepHostedService(scopeFactory, logger)
{
    protected override TimeSpan InitialDelay { get; } = TimeSpan.FromSeconds(20);

    protected override TimeSpan Interval { get; } = TimeSpan.FromMinutes(2);

    protected override string SweepName => "Inspector fee ledger maintenance sweep";

    protected override async Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var writer = services.GetRequiredService<IInspectorFeeLedgerWriter>();
        await writer.BackfillMissingLedgersAsync(cancellationToken);
        await writer.SyncLedgerSnapshotsFromTasksAsync(cancellationToken);
    }
}
