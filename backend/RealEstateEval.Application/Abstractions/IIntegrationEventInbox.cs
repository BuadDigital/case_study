namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Consumer-side deduplication. Integration event delivery is at-least-once, so a consumer
/// claims an event before handling it and only ever applies it once.
/// </summary>
public interface IIntegrationEventInbox
{
    /// <summary>
    /// Records that <paramref name="consumer"/> is handling <paramref name="eventId"/>.
    /// </summary>
    /// <returns>
    /// True when the claim was taken and the caller should handle the event; false when the
    /// event was already handled and should be acknowledged without reprocessing.
    /// </returns>
    Task<bool> TryBeginAsync(
        string consumer,
        Guid eventId,
        string eventType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Drops a claim after handling failed, so a redelivery is allowed to try again.
    /// </summary>
    Task ReleaseAsync(
        string consumer,
        Guid eventId,
        CancellationToken cancellationToken = default);
}
