namespace RealEstateEval.Application.Abstractions;

public interface IIntegrationEventPublisher
{
    Task PublishAsync<TPayload>(
        string eventType,
        TPayload payload,
        CancellationToken cancellationToken = default);
}
