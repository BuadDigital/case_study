using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Infrastructure.Services;

/// <summary>Periodically auto-reminds active operations tasks within work hours.</summary>
public sealed class OperationsTaskReminderHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<OperationsTaskReminderHostedService> logger)
    : PeriodicSweepHostedService(scopeFactory, logger)
{
 // Delay first run slightly so the API finishes warming up.
    protected override TimeSpan InitialDelay { get; } = TimeSpan.FromSeconds(20);

    protected override TimeSpan Interval { get; } = TimeSpan.FromMinutes(2);

    protected override string SweepName => "Operations task reminder sweep";

    protected override async Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var tasks = services.GetRequiredService<IOperationsTaskService>();
        var n = await tasks.ProcessDueAutoRemindersAsync(cancellationToken);
        if (n > 0)
            logger.LogInformation("Operations tasks auto-reminded: {Count}", n);
        var paused = await tasks.ProcessOverLimitPauseRemindersAsync(cancellationToken);
        if (paused > 0)
            logger.LogInformation("Operations tasks pause over-limit reminded: {Count}", paused);
    }
}
