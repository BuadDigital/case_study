using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// The safety net for the work orders' task slots (2026-11-19): every save of a work order or a
/// deed aligns its own slots (<see cref="IWorkflowTaskSlotSynchronizer.SyncPoAsync"/>); this sweep
/// aligns them all every ten minutes, for a path that changed a work order without that call.
/// It replaces the whole-table sync the browser used to ask for whenever someone read the work
/// orders — up to once a minute per open staff tab.
/// </summary>
public sealed class WorkflowTaskSlotSweepHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<WorkflowTaskSlotSweepHostedService> logger)
    : PeriodicSweepHostedService(scopeFactory, logger)
{
    // After start-up has settled, so a deploy's first requests do not compete with it.
    protected override TimeSpan InitialDelay { get; } = TimeSpan.FromMinutes(1);

    protected override TimeSpan Interval { get; } = TimeSpan.FromMinutes(10);

    protected override string SweepName => "Workflow task slot sweep";

    protected override Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken) =>
        services.GetRequiredService<IWorkflowTaskSlotSynchronizer>().SyncAllAsync(cancellationToken);
}
