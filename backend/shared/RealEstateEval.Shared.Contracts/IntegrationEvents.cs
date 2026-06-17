namespace RealEstateEval.Shared.Contracts;

/// <summary>Cross-service integration event envelope (RabbitMQ topic routing).</summary>
public sealed record IntegrationEventEnvelope<TPayload>(
    Guid EventId,
    string EventType,
    DateTimeOffset OccurredAtUtc,
    TPayload Payload);

public static class IntegrationEventTypes
{
    public const string PropertyCreated = "case.property.created.v1";
    public const string ValuationRequestCreated = "valuation.request.created.v1";
    public const string ValuationReportSubmitted = "valuation.report.submitted.v1";
}

public sealed record PropertyCreatedPayload(string PropertyId, string PoNumber);

public sealed record ValuationRequestCreatedPayload(
    string ValuationRequestId,
    string PropertyId,
    string PoNumber);

public sealed record ValuationReportSubmittedPayload(
    Guid ValuationRequestId,
    string PropertyId,
    string DisplayId,
    string Appraiser);
