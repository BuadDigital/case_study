using System.Text.Json;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>Pushes <see cref="IntegrationEventTypes.NotificationUserCreated"/> to connected SSE clients.</summary>
public sealed class NotificationRealtimePushHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly INotificationRealtimePublisher _realtime;
    private readonly ILogger<NotificationRealtimePushHandler> _logger;

    public NotificationRealtimePushHandler(
        INotificationRealtimePublisher realtime,
        ILogger<NotificationRealtimePushHandler> logger)
    {
        _realtime = realtime;
        _logger = logger;
    }

    public Task HandleEnvelopeAsync(string payloadJson, CancellationToken cancellationToken = default)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;
        var eventType = root.TryGetProperty("eventType", out var et)
            ? et.GetString()
            : root.GetProperty("EventType").GetString();

        if (!string.Equals(eventType, IntegrationEventTypes.NotificationUserCreated, StringComparison.Ordinal))
            return Task.CompletedTask;

        var payloadElement = root.TryGetProperty("payload", out var p) ? p : root.GetProperty("Payload");
        var payload = payloadElement.Deserialize<NotificationUserCreatedPayload>(JsonOpts);
        if (payload is null)
        {
            _logger.LogWarning("NotificationUserCreated payload missing or invalid");
            return Task.CompletedTask;
        }

        _realtime.Publish(payload.UserId, ToDto(payload));
        _logger.LogDebug(
            "NotificationUserCreated: pushed SSE for user {UserId} notification {NotificationId}",
            payload.UserId,
            payload.Id);

        return Task.CompletedTask;
    }

    private static UserNotificationDto ToDto(NotificationUserCreatedPayload payload) => new()
    {
        Id = payload.Id,
        Title = payload.Title,
        Body = payload.Body,
        Href = payload.Href,
        Tone = payload.Tone,
        Category = payload.Category,
        EntityType = payload.EntityType,
        EntityId = payload.EntityId,
        Actor = payload.Actor,
        SourceEvent = payload.SourceEvent,
        CreatedAtUtc = payload.CreatedAtUtc,
        Read = payload.Read,
    };
}
