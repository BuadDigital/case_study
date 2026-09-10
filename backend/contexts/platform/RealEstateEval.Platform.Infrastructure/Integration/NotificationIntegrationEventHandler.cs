using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Platform.Infrastructure.Integration;

/// <summary>Creates user notifications from cross-service integration events.</summary>
public sealed class NotificationIntegrationEventHandler
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CaseInsensitive;

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

        if (string.Equals(eventType, IntegrationEventTypes.NotificationUsersRequested, StringComparison.Ordinal))
        {
            var payload = payloadElement.Deserialize<NotificationUsersRequestedPayload>(JsonOpts);
            if (payload is not null)
            {
                await HandleNotificationUsersRequestedAsync(payload, eventId, cancellationToken);
            }

            return;
        }

        if (string.Equals(eventType, IntegrationEventTypes.ValuationReportSubmitted, StringComparison.Ordinal))
        {
            var payload = payloadElement.Deserialize<ValuationReportSubmittedPayload>(JsonOpts);
            if (payload is not null)
            {
                await HandleValuationReportSubmittedAsync(payload, eventId, cancellationToken);
            }

            return;
        }

        if (string.Equals(eventType, IntegrationEventTypes.ValuationWorkflowNotice, StringComparison.Ordinal))
        {
            var payload = payloadElement.Deserialize<ValuationWorkflowNoticePayload>(JsonOpts);
            if (payload is not null)
            {
                await HandleValuationWorkflowNoticeAsync(payload, eventId, cancellationToken);
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

    private async Task HandleNotificationUsersRequestedAsync(
        NotificationUsersRequestedPayload payload,
        string? eventId,
        CancellationToken cancellationToken)
    {
        var recipients = payload.UserIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (recipients.Count == 0 || string.IsNullOrWhiteSpace(payload.Title))
            return;

        var sourceEvent = string.IsNullOrWhiteSpace(payload.SourceEvent)
            ? BuildSourceEvent(IntegrationEventTypes.NotificationUsersRequested, eventId)
            : payload.SourceEvent;

        await _notifications.CreateForUsersAsync(
            recipients,
            new CreateUserNotificationRequest
            {
                Title = payload.Title,
                Body = payload.Body,
                Href = payload.Href,
                Tone = NotificationContract.Tones.Normalize(payload.Tone),
                Category = NotificationContract.Categories.Normalize(payload.Category),
                EntityType = NotificationContract.EntityTypes.Normalize(payload.EntityType),
                EntityId = payload.EntityId,
                Actor = payload.Actor,
                SourceEvent = sourceEvent,
            },
            cancellationToken);
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
            [
                WorkflowTaskKind.PropertyAppraisal,
                WorkflowTaskKind.CaseStudyProperty,
            ],
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
            [WorkflowTaskKind.PropertyAppraisal],
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

    /// <summary>
    /// Valuation knows the property, not who is assigned to it — this resolves the addressed
    /// audience to open task assignees and writes their inbox rows.
    /// </summary>
    private async Task HandleValuationWorkflowNoticeAsync(
        ValuationWorkflowNoticePayload payload,
        string? eventId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(payload.PropertyId, out var propertyId))
            return;
        if (string.IsNullOrWhiteSpace(payload.Title))
            return;

        WorkflowTaskKind[] kinds = payload.Audience switch
        {
            ValuationNoticeAudiences.CaseSpecialist => [WorkflowTaskKind.CaseStudyProperty],
            ValuationNoticeAudiences.Appraiser => [WorkflowTaskKind.PropertyAppraisal],
            _ => [],
        };
        if (kinds.Length == 0)
        {
            _logger.LogWarning(
                "ValuationWorkflowNotice: unknown audience {Audience} for property {PropertyId}",
                payload.Audience,
                propertyId);
            return;
        }

        var recipientIds = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
            propertyId,
            kinds,
            cancellationToken);
        if (recipientIds.Count == 0)
        {
            _logger.LogInformation(
                "ValuationWorkflowNotice: no {Audience} to notify for property {PropertyId}",
                payload.Audience,
                propertyId);
            return;
        }

        var request = new CreateUserNotificationRequest
        {
            Title = payload.Title,
            Body = payload.Body,
            Tone = NotificationContract.Tones.Normalize(payload.Tone),
            Href = payload.Href,
            Category = NotificationContract.Categories.Workflow,
            EntityType = NotificationContract.EntityTypes.Property,
            EntityId = payload.PropertyId,
            SourceEvent = BuildSourceEvent(IntegrationEventTypes.ValuationWorkflowNotice, eventId),
        };

        var count = await _notifications.CreateForUsersAsync(recipientIds, request, cancellationToken);
        _logger.LogInformation(
            "ValuationWorkflowNotice: created notifications for {Count} users on property {PropertyId}",
            count,
            propertyId);
    }

    private static string BuildSourceEvent(string eventType, string? eventId) =>
        string.IsNullOrWhiteSpace(eventId) ? eventType : $"{eventType}:{eventId}";
}
