using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Integration;

/// <inheritdoc />
/// <remarks>
/// Case Study residual consumers write through <see cref="ApplicationDbContext"/>.
/// Platform writes through <see cref="MessagingDbContext"/> when that context is registered
/// (see <see cref="DependencyInjection.AddIntegrationEventInbox"/>).
/// </remarks>
public sealed class IntegrationEventInbox : IIntegrationEventInbox
{
    private readonly DbContext _db;
    private readonly DbSet<ProcessedIntegrationEvent> _events;
    private readonly ILogger<IntegrationEventInbox> _logger;

    public IntegrationEventInbox(ApplicationDbContext db, ILogger<IntegrationEventInbox> logger)
        : this((DbContext)db, db.ProcessedIntegrationEvents, logger)
    {
    }

    public IntegrationEventInbox(MessagingDbContext db, ILogger<IntegrationEventInbox> logger)
        : this(db, db.ProcessedIntegrationEvents, logger)
    {
    }

    private IntegrationEventInbox(
        DbContext db,
        DbSet<ProcessedIntegrationEvent> events,
        ILogger<IntegrationEventInbox> logger)
    {
        _db = db;
        _events = events;
        _logger = logger;
    }

    public async Task<bool> TryBeginAsync(
        string consumer,
        Guid eventId,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        var alreadyHandled = await _events
            .AnyAsync(x => x.Consumer == consumer && x.EventId == eventId, cancellationToken);
        if (alreadyHandled)
        {
            LogDuplicate(consumer, eventId, eventType);
            return false;
        }

        _events.Add(new ProcessedIntegrationEvent
        {
            Consumer = consumer,
            EventId = eventId,
            EventType = eventType,
            ProcessedAtUtc = DateTime.UtcNow,
        });

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException)
        {
 // Two deliveries of the same event raced past the check above and the primary key
 // rejected the loser. Losing that race is the expected outcome, not a failure.
            _db.ChangeTracker.Clear();
            LogDuplicate(consumer, eventId, eventType);
            return false;
        }
    }

    public async Task ReleaseAsync(
        string consumer,
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        var claim = await _events
            .FirstOrDefaultAsync(
                x => x.Consumer == consumer && x.EventId == eventId,
                cancellationToken);
        if (claim is null)
            return;

        _events.Remove(claim);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private void LogDuplicate(string consumer, Guid eventId, string eventType) =>
        _logger.LogInformation(
            "Skipping duplicate {EventType} {EventId} for consumer {Consumer}",
            eventType,
            eventId,
            consumer);
}
