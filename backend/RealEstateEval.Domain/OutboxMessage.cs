namespace RealEstateEval.Domain;

/// <summary>Transactional outbox row — dispatched to RabbitMQ by <c>OutboxDispatcherHostedService</c>.</summary>
public class OutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = "";
    public string PayloadJson { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ProcessedAtUtc { get; set; }
    public string? Error { get; set; }
}
