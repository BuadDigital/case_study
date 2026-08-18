using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Application;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Which <see cref="IOutboxContext"/> this dispatcher drains. Case Study binds
/// <c>MessagingDbContext</c> (dedicated messaging database after Phase 4). Valuation binds
/// <c>ValuationDbContext</c> so its dedicated outbox is not left stranded.
/// </summary>
public sealed class OutboxDispatcherOptions
{
    public Type ContextType { get; set; } = typeof(MessagingDbContext);
}

public sealed class OutboxDispatcherHostedService : BackgroundService
{
 /// <summary>
 /// Idle poll cadence. Keep short so assignment notifications (distribution →
 /// outbox → Platform) reach the assignee within a couple of seconds instead of
 /// waiting up to half a minute after the dispatcher goes quiet.
 /// </summary>
    private static readonly int[] EmptyBackoffSeconds = [1, 2, 3, 5];

    private const int BatchSize = 25;

 /// <summary>Attempts before a row is parked as a poison message.</summary>
    private const int MaxAttempts = 10;

 /// <summary>
 /// How long a claim is honoured. Long enough for a batch to publish, short enough that a
 /// dispatcher killed mid-batch has its rows picked up again promptly.
 /// </summary>
    private static readonly TimeSpan LeaseDuration = TimeSpan.FromMinutes(2);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RabbitMqOptions _options;
    private readonly OutboxDispatcherOptions _dispatcherOptions;
    private readonly ILogger<OutboxDispatcherHostedService> _logger;
    private readonly TimeProvider _time;
    private int _emptyBackoffIndex;

    public OutboxDispatcherHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitMqOptions> options,
        IOptions<OutboxDispatcherOptions> dispatcherOptions,
        ILogger<OutboxDispatcherHostedService> logger,
        TimeProvider? time = null)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _dispatcherOptions = dispatcherOptions.Value;
        _logger = logger;
        _time = time ?? TimeProvider.System;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
 // Draining the outbox without a broker would discard events, so leave the rows
 // queued for whenever messaging is turned back on.
            _logger.LogInformation("RabbitMQ disabled; outbox dispatcher idle");
            return;
        }

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
        var outbox = ResolveOutbox(scope.ServiceProvider);
        var rabbit = scope.ServiceProvider.GetRequiredService<RabbitMqMessagePublisher>();

        var owner = $"{Environment.MachineName}:{Guid.NewGuid():N}";
        var claimed = await ClaimBatchAsync(outbox, owner, stoppingToken);
        if (claimed.Count == 0)
            return 0;

        var delivered = 0;
        var undelivered = 0;

        foreach (var message in claimed)
        {
            try
            {
                if (await rabbit.PublishAsync(message.EventType, message.PayloadJson, stoppingToken))
                {
                    message.ProcessedAtUtc = _time.UtcNow();
                    message.Error = null;
                    message.LockedUntilUtc = null;
                    message.LockedBy = null;
                    delivered++;
                    continue;
                }

 // Broker unreachable rather than a bad message: release the claim and refund
 // the attempt so an outage cannot dead-letter healthy events.
                message.AttemptCount = Math.Max(0, message.AttemptCount - 1);
                message.LockedUntilUtc = null;
                message.LockedBy = null;
                undelivered++;
            }
            catch (Exception ex)
            {
                message.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                message.LockedUntilUtc = null;
                message.LockedBy = null;

                if (message.AttemptCount >= MaxAttempts)
                {
                    message.DeadLetteredAtUtc = _time.UtcNow();
                    _logger.LogError(
                        ex,
                        "Outbox message {MessageId} dead-lettered after {Attempts} attempts",
                        message.Id,
                        message.AttemptCount);
                }
                else
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to dispatch outbox message {MessageId} (attempt {Attempts})",
                        message.Id,
                        message.AttemptCount);
                }
            }
        }

        await outbox.SaveChangesAsync(stoppingToken);

        if (undelivered > 0)
        {
            _logger.LogWarning(
                "Broker unavailable; {Count} outbox message(s) left queued",
                undelivered);
        }

        if (delivered > 0)
            _logger.LogInformation("Dispatched {Count} outbox message(s)", delivered);

        return delivered;
    }

    private IOutboxContext ResolveOutbox(IServiceProvider services)
    {
        var type = _dispatcherOptions.ContextType;
        if (!typeof(IOutboxContext).IsAssignableFrom(type))
        {
            throw new InvalidOperationException(
                $"OutboxDispatcherOptions.ContextType must implement IOutboxContext (got {type.Name}).");
        }

        return (IOutboxContext)services.GetRequiredService(type);
    }

 /// <summary>
 /// Takes a lease on a batch of pending rows. On PostgreSQL the candidate select uses
 /// FOR UPDATE SKIP LOCKED so concurrent dispatchers claim disjoint rows instead of
 /// publishing the same event twice.
 /// </summary>
    private async Task<List<OutboxMessage>> ClaimBatchAsync(
        IOutboxContext outbox,
        string owner,
        CancellationToken stoppingToken)
    {
        var now = _time.UtcNow();
        var lease = now.Add(LeaseDuration);

        if (outbox is not DbContext db)
            return await ClaimWithoutLockingAsync(outbox, owner, now, lease, stoppingToken);

        if (!db.Database.IsRelational())
            return await ClaimWithoutLockingAsync(outbox, owner, now, lease, stoppingToken);

        const string sql = """
            UPDATE messaging."OutboxMessages"
            SET "LockedUntilUtc" = {0}, "LockedBy" = {1}, "AttemptCount" = "AttemptCount" + 1
            WHERE "Id" IN (
                SELECT "Id" FROM messaging."OutboxMessages"
                WHERE "ProcessedAtUtc" IS NULL
                  AND "DeadLetteredAtUtc" IS NULL
                  AND ("LockedUntilUtc" IS NULL OR "LockedUntilUtc" < {2})
                ORDER BY "CreatedAtUtc"
                LIMIT {3}
                FOR UPDATE SKIP LOCKED
            )
            """;

        var affected = await db.Database.ExecuteSqlRawAsync(
            sql,
            [lease, owner, now, BatchSize],
            stoppingToken);

        if (affected == 0)
            return [];

        return await outbox.OutboxMessages
            .Where(m => m.LockedBy == owner && m.ProcessedAtUtc == null)
            .OrderBy(m => m.CreatedAtUtc)
            .ToListAsync(stoppingToken);
    }

 /// <summary>
 /// Fallback for non-relational providers used in tests, where row locking is unavailable.
 /// </summary>
    private static async Task<List<OutboxMessage>> ClaimWithoutLockingAsync(
        IOutboxContext outbox,
        string owner,
        DateTime now,
        DateTime lease,
        CancellationToken stoppingToken)
    {
        var pending = await outbox.OutboxMessages
            .Where(m => m.ProcessedAtUtc == null
                && m.DeadLetteredAtUtc == null
                && (m.LockedUntilUtc == null || m.LockedUntilUtc < now))
            .OrderBy(m => m.CreatedAtUtc)
            .Take(BatchSize)
            .ToListAsync(stoppingToken);

        foreach (var message in pending)
        {
            message.LockedUntilUtc = lease;
            message.LockedBy = owner;
            message.AttemptCount++;
        }

        return pending;
    }
}
