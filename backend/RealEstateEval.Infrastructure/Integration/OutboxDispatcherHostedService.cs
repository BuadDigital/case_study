using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace RealEstateEval.Infrastructure.Integration;

public sealed class OutboxDispatcherHostedService : BackgroundService
{
    private static readonly int[] EmptyBackoffSeconds = [2, 5, 10, 20, 30];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxDispatcherHostedService> _logger;
    private int _emptyBackoffIndex;

    public OutboxDispatcherHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<OutboxDispatcherHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delaySeconds = EmptyBackoffSeconds[_emptyBackoffIndex];

            try
            {
                var dispatched = await DispatchBatchAsync(stoppingToken);
                if (dispatched > 0)
                {
                    _emptyBackoffIndex = 0;
                    delaySeconds = EmptyBackoffSeconds[0];
                }
                else if (_emptyBackoffIndex < EmptyBackoffSeconds.Length - 1)
                {
                    _emptyBackoffIndex++;
                    delaySeconds = EmptyBackoffSeconds[_emptyBackoffIndex];
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Outbox dispatch batch failed; retrying in {DelaySeconds}s", delaySeconds);
            }

            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
        }
    }

    /// <returns>Number of outbox rows processed in this batch (0 when idle).</returns>
    private async Task<int> DispatchBatchAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.ApplicationDbContext>();
        var rabbit = scope.ServiceProvider.GetRequiredService<RabbitMqMessagePublisher>();

        var pending = await db.OutboxMessages
            .Where(m => m.ProcessedAtUtc == null)
            .OrderBy(m => m.CreatedAtUtc)
            .Take(25)
            .ToListAsync(stoppingToken);

        if (pending.Count == 0)
            return 0;

        foreach (var message in pending)
        {
            try
            {
                await rabbit.PublishAsync(message.EventType, message.PayloadJson, stoppingToken);
                message.ProcessedAtUtc = DateTime.UtcNow;
                message.Error = null;
            }
            catch (Exception ex)
            {
                message.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                _logger.LogWarning(ex, "Failed to dispatch outbox message {MessageId}", message.Id);
            }
        }

        await db.SaveChangesAsync(stoppingToken);
        _logger.LogInformation("Dispatched {Count} outbox message(s)", pending.Count);
        return pending.Count;
    }
}
