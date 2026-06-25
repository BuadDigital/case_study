using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>Creates user notifications from cross-service integration events.</summary>
public sealed class NotificationIntegrationEventHandler
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly NotificationRecipientResolver _recipients;
    private readonly INotificationService _notifications;
    private readonly ILogger<NotificationIntegrationEventHandler> _logger;

    public NotificationIntegrationEventHandler(
        NotificationRecipientResolver recipients,
        INotificationService notifications,
        ILogger<NotificationIntegrationEventHandler> logger)
    {
        _recipients = recipients;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task HandleEnvelopeAsync(string payloadJson, CancellationToken cancellationToken = default)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;
        var eventType = root.TryGetProperty("eventType", out var et)
            ? et.GetString()
            : root.GetProperty("EventType").GetString();

        var eventId = root.TryGetProperty("eventId", out var eid)
            ? eid.GetString()
            : root.GetProperty("EventId").GetString();

        if (string.IsNullOrWhiteSpace(eventType)) return;

        var payloadElement = root.TryGetProperty("payload", out var p) ? p : root.GetProperty("Payload");

        if (string.Equals(eventType, IntegrationEventTypes.ValuationReportSubmitted, StringComparison.Ordinal))
        {
            var payload = payloadElement.Deserialize<ValuationReportSubmittedPayload>(JsonOpts);
            if (payload is not null)
            {
                await HandleValuationReportSubmittedAsync(payload, eventId, cancellationToken);
            }

            return;
        }

        if (string.Equals(eventType, IntegrationEventTypes.ValuationRequestCreated, StringComparison.Ordinal))
        {
            var payload = payloadElement.Deserialize<ValuationRequestCreatedPayload>(JsonOpts);
            if (payload is not null)
            {
                await HandleValuationRequestCreatedAsync(payload, eventId, cancellationToken);
            }
        }
    }

    private async Task HandleValuationReportSubmittedAsync(
        ValuationReportSubmittedPayload payload,
        string? eventId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(payload.PropertyId, out var propertyId))
            return;

        var recipientIds = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
            propertyId,
            ["property-appraisal", "valuation-coordination", "case-study-property"],
            cancellationToken);

        if (recipientIds.Count == 0)
        {
            _logger.LogInformation(
                "ValuationReportSubmitted: no assignees to notify for property {PropertyId}",
                propertyId);
            return;
        }

        var request = new CreateUserNotificationRequest
        {
            Title = "تقرير مقيم جديد",
            Body = $"اكتمل تقرير المقيم {payload.Appraiser} للعقار {payload.DisplayId}.",
            Tone = "success",
            Href = "/property-appraisal",
            Category = "workflow",
            EntityType = "property",
            EntityId = payload.PropertyId,
            Actor = payload.Appraiser,
            SourceEvent = BuildSourceEvent(IntegrationEventTypes.ValuationReportSubmitted, eventId),
        };

        var count = await _notifications.CreateForUsersAsync(recipientIds, request, cancellationToken);
        _logger.LogInformation(
            "ValuationReportSubmitted: created notifications for {Count} users on property {PropertyId}",
            count,
            propertyId);
    }

    private async Task HandleValuationRequestCreatedAsync(
        ValuationRequestCreatedPayload payload,
        string? eventId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(payload.PropertyId, out var propertyId))
            return;

        var recipientIds = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
            propertyId,
            ["property-appraisal", "valuation-coordination"],
            cancellationToken);

        if (recipientIds.Count == 0)
        {
            _logger.LogInformation(
                "ValuationRequestCreated: no assignees to notify for property {PropertyId}",
                propertyId);
            return;
        }

        var po = string.IsNullOrWhiteSpace(payload.PoNumber) ? "—" : payload.PoNumber;
        var request = new CreateUserNotificationRequest
        {
            Title = "طلب تقييم جديد",
            Body = $"طُلِب تقييم عقاري لأمر العمل {po}.",
            Tone = "info",
            Href = "/valuation-requests",
            Category = "workflow",
            EntityType = "property",
            EntityId = payload.PropertyId,
            SourceEvent = BuildSourceEvent(IntegrationEventTypes.ValuationRequestCreated, eventId),
        };

        var count = await _notifications.CreateForUsersAsync(recipientIds, request, cancellationToken);
        _logger.LogInformation(
            "ValuationRequestCreated: created notifications for {Count} users on property {PropertyId}",
            count,
            propertyId);
    }

    private static string BuildSourceEvent(string eventType, string? eventId) =>
        string.IsNullOrWhiteSpace(eventId) ? eventType : $"{eventType}:{eventId}";
}
