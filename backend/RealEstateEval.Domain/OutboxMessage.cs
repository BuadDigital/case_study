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

    /// <summary>
    /// Lease held by the dispatcher instance that claimed this row. Rows whose lease has
    /// lapsed are reclaimable, so a dispatcher that crashes mid-batch does not strand work.
    /// </summary>
    public DateTime? LockedUntilUtc { get; set; }

    /// <summary>Owner of the current lease — diagnostic only.</summary>
    public string? LockedBy { get; set; }

    /// <summary>Delivery attempts so far, used to stop retrying poison messages.</summary>
    public int AttemptCount { get; set; }

    /// <summary>
    /// Set once <see cref="AttemptCount"/> exhausts the retry budget. The row stops being
    /// picked up and needs an operator to requeue it.
    /// </summary>
    public DateTime? DeadLetteredAtUtc { get; set; }
}
