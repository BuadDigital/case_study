using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Polls the dispatcher-bound outbox for backlog gauges. Runs on Case Study and Valuation
/// only (the hosts that register <c>AddOutboxDispatcher</c>).
/// </summary>
public sealed class OutboxMetricsCollectorHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(15);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly OutboxDispatcherOptions _dispatcherOptions;
    private readonly OutboxMetrics _metrics;
    private readonly ILogger<OutboxMetricsCollectorHostedService> _logger;
    private readonly TimeProvider _time;

    public OutboxMetricsCollectorHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<OutboxDispatcherOptions> dispatcherOptions,
        OutboxMetrics metrics,
        ILogger<OutboxMetricsCollectorHostedService> logger,
        TimeProvider? time = null)
    {
        _scopeFactory = scopeFactory;
        _dispatcherOptions = dispatcherOptions.Value;
        _metrics = metrics;
        _logger = logger;
        _time = time ?? TimeProvider.System;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SampleAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Outbox backlog sample failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    internal async Task SampleAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var outbox = (IOutboxContext)scope.ServiceProvider.GetRequiredService(
            _dispatcherOptions.ContextType);

        var pending = await outbox.OutboxMessages
            .Where(m => m.ProcessedAtUtc == null && m.DeadLetteredAtUtc == null)
            .Select(m => m.CreatedAtUtc)
            .ToListAsync(stoppingToken);

        var deadLettered = await outbox.OutboxMessages
            .CountAsync(m => m.DeadLetteredAtUtc != null, stoppingToken);

        var oldestAge = 0d;
        if (pending.Count > 0)
        {
            var oldest = pending.Min();
            oldestAge = Math.Max(0, (_time.UtcNow() - oldest).TotalSeconds);
        }

        _metrics.SetBacklog(pending.Count, deadLettered, oldestAge);
    }
}
