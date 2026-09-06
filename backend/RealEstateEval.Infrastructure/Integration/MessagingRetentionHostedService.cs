using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Application;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// How long the append-only messaging rows are kept once they have done their job. Bound from
/// the <c>MessagingRetention</c> configuration section; every value is in days except the sweep
/// interval.
/// </summary>
public sealed class MessagingRetentionOptions
{
    public const string SectionName = "MessagingRetention";

    public bool Enabled { get; set; } = true;

    /// <summary>Minutes between sweeps.</summary>
    public int IntervalMinutes { get; set; } = 60;

    /// <summary>Outbox rows the dispatcher has published.</summary>
    public int ProcessedOutboxDays { get; set; } = 7;

    /// <summary>Outbox rows parked as poison messages, kept longer so they can be inspected.</summary>
    public int DeadLetteredOutboxDays { get; set; } = 30;

    /// <summary>Inbox dedupe rows; must outlive the broker's redelivery window by a wide margin.</summary>
    public int ProcessedInboxDays { get; set; } = 30;

    /// <summary>Notifications the user has read.</summary>
    public int ReadNotificationDays { get; set; } = 90;
}

/// <summary>
/// Sweeps the messaging tables that only ever grow: published and dead-lettered outbox rows,
/// inbox dedupe rows, expired command-idempotency responses, and read notifications. Runs in the
/// same host as the outbox dispatcher and drains the same <see cref="IOutboxContext"/>; the
/// inbox, idempotency and notification tables exist only on <see cref="MessagingDbContext"/>,
/// so a host draining another outbox (Valuation) sweeps its outbox alone.
/// </summary>
public sealed class MessagingRetentionHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MessagingRetentionOptions _options;
    private readonly OutboxDispatcherOptions _dispatcherOptions;
    private readonly ILogger<MessagingRetentionHostedService> _logger;
    private readonly TimeProvider _time;

    public MessagingRetentionHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<MessagingRetentionOptions> options,
        IOptions<OutboxDispatcherOptions> dispatcherOptions,
        ILogger<MessagingRetentionHostedService> logger,
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
            _logger.LogInformation("Messaging retention is disabled.");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.IntervalMinutes));

        // First sweep shortly after start-up so a long-idle service catches up, then hourly.
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Messaging retention sweep failed; retrying in {Interval}", interval);
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    /// <summary>One pass over every retained table. Public so the deploy tooling and tests can run it directly.</summary>
    public async Task SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = (DbContext)scope.ServiceProvider.GetRequiredService(_dispatcherOptions.ContextType);
        if (db is not IOutboxContext outbox)
            throw new InvalidOperationException(
                $"{_dispatcherOptions.ContextType.Name} does not map the outbox.");

        var now = _time.UtcNow();
        var processedCutoff = now.AddDays(-Math.Max(1, _options.ProcessedOutboxDays));
        var deadLetterCutoff = now.AddDays(-Math.Max(1, _options.DeadLetteredOutboxDays));

        var outboxDeleted = await outbox.OutboxMessages
            .Where(m => m.ProcessedAtUtc != null && m.ProcessedAtUtc < processedCutoff)
            .ExecuteDeleteAsync(cancellationToken);
        outboxDeleted += await outbox.OutboxMessages
            .Where(m => m.ProcessedAtUtc == null
                && m.DeadLetteredAtUtc != null
                && m.DeadLetteredAtUtc < deadLetterCutoff)
            .ExecuteDeleteAsync(cancellationToken);

        var inboxDeleted = 0;
        var idempotencyDeleted = 0;
        var notificationsDeleted = 0;
        if (db is MessagingDbContext messaging)
        {
            var inboxCutoff = now.AddDays(-Math.Max(1, _options.ProcessedInboxDays));
            var readCutoff = now.AddDays(-Math.Max(1, _options.ReadNotificationDays));

            inboxDeleted = await messaging.ProcessedIntegrationEvents
                .Where(e => e.ProcessedAtUtc < inboxCutoff)
                .ExecuteDeleteAsync(cancellationToken);
            idempotencyDeleted = await messaging.CommandIdempotencyRecords
                .Where(r => r.ExpiresAtUtc < now)
                .ExecuteDeleteAsync(cancellationToken);
            notificationsDeleted = await messaging.UserNotifications
                .Where(n => n.ReadAtUtc != null && n.ReadAtUtc < readCutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }

        if (outboxDeleted + inboxDeleted + idempotencyDeleted + notificationsDeleted > 0)
        {
            _logger.LogInformation(
                "Messaging retention removed {Outbox} outbox, {Inbox} inbox, {Idempotency} idempotency and {Notifications} read notification rows.",
                outboxDeleted,
                inboxDeleted,
                idempotencyDeleted,
                notificationsDeleted);
        }
    }
}
