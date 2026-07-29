using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Integration;

/// <inheritdoc />
public sealed class IntegrationEventInbox(
    ApplicationDbContext db,
    ILogger<IntegrationEventInbox> logger) : IIntegrationEventInbox
{
    public async Task<bool> TryBeginAsync(
        string consumer,
        Guid eventId,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        var alreadyHandled = await db.ProcessedIntegrationEvents
            .AnyAsync(x => x.Consumer == consumer && x.EventId == eventId, cancellationToken);
        if (alreadyHandled)
        {
            LogDuplicate(consumer, eventId, eventType);
            return false;
        }

        db.ProcessedIntegrationEvents.Add(new ProcessedIntegrationEvent
        {
            Consumer = consumer,
            EventId = eventId,
            EventType = eventType,
            ProcessedAtUtc = DateTime.UtcNow,
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException)
        {
            // Two deliveries of the same event raced past the check above and the primary key
            // rejected the loser. Losing that race is the expected outcome, not a failure.
            db.ChangeTracker.Clear();
            LogDuplicate(consumer, eventId, eventType);
            return false;
        }
    }

    public async Task ReleaseAsync(
        string consumer,
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        var claim = await db.ProcessedIntegrationEvents
            .FirstOrDefaultAsync(
                x => x.Consumer == consumer && x.EventId == eventId,
                cancellationToken);
        if (claim is null)
            return;

        db.ProcessedIntegrationEvents.Remove(claim);
        await db.SaveChangesAsync(cancellationToken);
    }

    private void LogDuplicate(string consumer, Guid eventId, string eventType) =>
        logger.LogInformation(
            "Skipping duplicate {EventType} {EventId} for consumer {Consumer}",
            eventType,
            eventId,
            consumer);
}
