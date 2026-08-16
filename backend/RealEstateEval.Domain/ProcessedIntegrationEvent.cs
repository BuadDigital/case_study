namespace RealEstateEval.Domain;

/// <summary>
/// Consumer-side inbox. Delivery is at-least-once — the broker redelivers after a crash and
/// the outbox republishes rows it could not confirm — so each consumer records the events it
/// has already handled and skips repeats instead of applying them twice.
/// </summary>
public class ProcessedIntegrationEvent
{
 /// <summary>Envelope id of the integration event.</summary>
    public Guid EventId { get; set; }

 /// <summary>
 /// Logical consumer name. Part of the key so independent consumers each get their own
 /// chance to handle the same event.
 /// </summary>
    public string Consumer { get; set; } = "";

    public string EventType { get; set; } = "";
    public DateTime ProcessedAtUtc { get; set; }
}
