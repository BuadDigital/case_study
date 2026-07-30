using System.Text.Json;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Writes integration events to the outbox in the same EF transaction as domain changes.
/// <para>
/// Decision D5 makes the outbox per-producer, so the publisher is bound to the context that
/// owns the business change. Publishing through a different context would split the event
/// and the change it describes across two <c>SaveChanges</c> calls and lose atomicity.
/// </para>
/// </summary>
public abstract class OutboxIntegrationEventPublisher<TContext> : IIntegrationEventPublisher
    where TContext : IOutboxContext
{
    private readonly TContext _db;
    private readonly ILogger _logger;

    protected OutboxIntegrationEventPublisher(TContext db, ILogger logger)
    {
        _db = db;
        _logger = logger;
    }

    public Task PublishAsync<TPayload>(
        string eventType,
        TPayload payload,
        CancellationToken cancellationToken = default)
    {
        var envelope = new IntegrationEventEnvelope<TPayload>(
            Guid.NewGuid(),
            eventType,
            DateTimeOffset.UtcNow,
            payload);

        var json = JsonSerializer.Serialize(envelope);
        _db.OutboxMessages.Add(new OutboxMessage
        {
            Id = envelope.EventId,
            EventType = eventType,
            PayloadJson = json,
            CreatedAtUtc = DateTime.UtcNow,
        });

        _logger.LogDebug("Queued outbox event {EventType}", eventType);
        return Task.CompletedTask;
    }
}

/// <summary>Outbox writer for every slice still hosted on the legacy context.</summary>
public sealed class OutboxIntegrationEventPublisher(
    ApplicationDbContext db,
    ILogger<OutboxIntegrationEventPublisher> logger)
    : OutboxIntegrationEventPublisher<ApplicationDbContext>(db, logger);

/// <summary>Outbox writer owned by the Valuation context (D5).</summary>
public sealed class ValuationOutboxPublisher(
    ValuationDbContext db,
    ILogger<ValuationOutboxPublisher> logger)
    : OutboxIntegrationEventPublisher<ValuationDbContext>(db, logger), IValuationEventPublisher;
