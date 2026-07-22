using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Periodically auto-reminds active operations tasks within work hours.</summary>
public sealed class OperationsTaskReminderHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OperationsTaskReminderHostedService> _logger;

    public OperationsTaskReminderHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<OperationsTaskReminderHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Delay first run slightly so the API finishes warming up.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
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
                var tasks = scope.ServiceProvider.GetRequiredService<IOperationsTaskService>();
                var n = await tasks.ProcessDueAutoRemindersAsync(stoppingToken);
                if (n > 0)
                    _logger.LogInformation("Operations tasks auto-reminded: {Count}", n);
                var paused = await tasks.ProcessOverLimitPauseRemindersAsync(stoppingToken);
                if (paused > 0)
                    _logger.LogInformation("Operations tasks pause over-limit reminded: {Count}", paused);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Operations task reminder sweep failed");
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
