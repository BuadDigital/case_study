using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Removes expired owner-local command reservations on hosts that do not drain an outbox.
/// </summary>
public sealed class CommandIdempotencyRetentionHostedService<TContext>(
    IServiceScopeFactory scopeFactory,
    IOptions<MessagingRetentionOptions> options,
    ILogger<CommandIdempotencyRetentionHostedService<TContext>> logger,
    TimeProvider? time = null) : BackgroundService
    where TContext : DbContext, ICommandIdempotencyDbContext
{
    private readonly MessagingRetentionOptions _options = options.Value;
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
            return;

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.IntervalMinutes));
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
                logger.LogWarning(
                    ex,
                    "Command idempotency retention sweep failed; retrying in {Interval}",
                    interval);
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    public async Task<int> SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();
        var now = _time.GetUtcNow().UtcDateTime;
        var abandonedBefore = now.AddDays(-7);
        var deleted = await db.CommandIdempotencyRecords
            .Where(row =>
                (row.StatusCode != 0 && row.ExpiresAtUtc < now)
                || (row.StatusCode == 0 && row.CreatedAtUtc < abandonedBefore))
            .ExecuteDeleteAsync(cancellationToken);

        if (deleted > 0)
        {
            logger.LogInformation(
                "Command idempotency retention removed {Count} expired rows from {Context}.",
                deleted,
                typeof(TContext).Name);
        }

        return deleted;
    }
}
