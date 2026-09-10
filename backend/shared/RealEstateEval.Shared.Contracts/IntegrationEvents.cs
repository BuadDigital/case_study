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
    public const string NotificationUsersRequested = "notification.users.requested.v1";
    public const string NotificationUserCreated = "notification.user.created.v1";
    public const string ValuationWorkflowNotice = "valuation.workflow.notice.v1";
}

/// <summary>Audiences a <see cref="ValuationWorkflowNoticePayload"/> can address.</summary>
public static class ValuationNoticeAudiences
{
    public const string Appraiser = "appraiser";
    public const string CaseSpecialist = "case-specialist";
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

/// <summary>
/// A valuation-side workflow event that has to reach a party Valuation cannot address itself:
/// it knows the property, not the assignees. Platform resolves <paramref name="Audience"/> to
/// the open task assignees and writes the inbox rows.
/// </summary>
public sealed record ValuationWorkflowNoticePayload(
    string PropertyId,
    string Audience,
    string Title,
    string Body,
    string Tone,
    string Href);

/// <summary>
/// Requests that Platform, the notification inbox owner, persist one notification for
/// each recipient. The enclosing integration event id is the idempotency boundary.
/// </summary>
public sealed record NotificationUsersRequestedPayload(
    IReadOnlyList<string> UserIds,
    string Title,
    string? Body,
    string? Href,
    string? Tone,
    string? Category,
    string? EntityType,
    string? EntityId,
    string? Actor,
    string? SourceEvent);

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
