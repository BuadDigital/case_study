namespace RealEstateEval.Shared.Contracts;

/// <summary>Cross-service integration event envelope (RabbitMQ topic routing).</summary>
public sealed record IntegrationEventEnvelope<TPayload>(
    Guid EventId,
    string EventType,
    DateTimeOffset OccurredAtUtc,
    TPayload Payload);

public static class IntegrationEventTypes
{
    public const string ValuationRequestCreated = "valuation.request.created.v1";
    public const string ValuationReportSubmitted = "valuation.report.submitted.v1";
    public const string NotificationUserCreated = "notification.user.created.v1";
}

public sealed record ValuationRequestCreatedPayload(
    string ValuationRequestId,
    string PropertyId,
    string PoNumber);

public sealed record ValuationReportSubmittedPayload(
    Guid ValuationRequestId,
    string PropertyId,
    string DisplayId,
    string Appraiser);

/// <summary>Published after a <c>UserNotifications</c> row is committed — fans out to SSE on Platform.</summary>
public sealed record NotificationUserCreatedPayload(
    string UserId,
    Guid Id,
    string Title,
    string? Body,
    string? Href,
    string? Tone,
    string? Category,
    string? EntityType,
    string? EntityId,
    string? Actor,
    string? SourceEvent,
    DateTime CreatedAtUtc,
    bool Read);
