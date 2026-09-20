namespace RealEstateEval.Application.Abstractions;

public interface IIntegrationEventPublisher
{
    Task PublishAsync<TPayload>(
        string eventType,
        TPayload payload,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// The publisher whose outbox rows are saved by the Valuation context.
/// <para>
/// Case Study hosts valuation endpoints alongside its own, and both processes register a
/// publisher. Depending on the unqualified <see cref="IIntegrationEventPublisher"/> there
/// would resolve Case Study's, writing the event through a context that never sees the
/// valuation row — so the event and the change it announces would no longer commit together.
/// </para>
/// </summary>
public interface IValuationEventPublisher : IIntegrationEventPublisher;
