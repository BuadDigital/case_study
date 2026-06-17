using System.Text.Json;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Writes integration events to the outbox in the same EF transaction as domain changes.
/// </summary>
public sealed class OutboxIntegrationEventPublisher : IIntegrationEventPublisher
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<OutboxIntegrationEventPublisher> _logger;

    public OutboxIntegrationEventPublisher(
        ApplicationDbContext db,
        ILogger<OutboxIntegrationEventPublisher> logger)
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
