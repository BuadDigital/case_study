using System.Text.Json;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Writes integration events to the outbox in the same EF transaction as domain changes.
/// <para>
/// makes the outbox per-producer, so the publisher is bound to the context that
/// owns the business change. Publishing through a different context would split the event
/// and the change it describes across two <c>SaveChanges</c> calls and lose atomicity.
/// </para>
/// </summary>
public abstract class OutboxIntegrationEventPublisher<TContext> : IIntegrationEventPublisher
    where TContext : IOutboxContext
{
    private readonly TContext _db;
    private readonly ILogger _logger;
    private readonly TimeProvider _time;

    protected OutboxIntegrationEventPublisher(TContext db, ILogger logger, TimeProvider? time = null)
    {
        _db = db;
        _logger = logger;
        _time = time ?? TimeProvider.System;
    }

    public Task PublishAsync<TPayload>(
        string eventType,
        TPayload payload,
        CancellationToken cancellationToken = default)
    {
        var envelope = new IntegrationEventEnvelope<TPayload>(
            Guid.NewGuid(),
            eventType,
            _time.GetUtcNow(),
            payload);

        var json = JsonSerializer.Serialize(envelope);
        _db.OutboxMessages.Add(new OutboxMessage
        {
            Id = envelope.EventId,
            EventType = eventType,
            PayloadJson = json,
            CreatedAtUtc = _time.UtcNow(),
        });

        _logger.LogDebug("Queued outbox event {EventType}", eventType);
        return Task.CompletedTask;
    }
}

/// <summary>Outbox writer for Platform messaging writes (notifications + same-UoW events).</summary>
public sealed class MessagingOutboxPublisher(
    MessagingDbContext db,
    ILogger<MessagingOutboxPublisher> logger,
    TimeProvider? time = null)
    : OutboxIntegrationEventPublisher<MessagingDbContext>(db, logger, time);

// A8 physical move: ValuationOutboxPublisher lives beside its context in
// RealEstateEval.Valuation.Infrastructure (Integration/ValuationOutboxPublisher.cs).
