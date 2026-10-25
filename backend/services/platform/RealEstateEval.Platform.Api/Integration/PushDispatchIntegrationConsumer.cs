using System.Text.Json;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Platform.Infrastructure.Services;

namespace RealEstateEval.Platform.Api.Integration;

/// <summary>
/// Durable shared consumer that delivers Web Push for each persisted user notification.
/// Distinct inbox consumer name from SSE fan-out so both process the same event.
/// </summary>
public sealed class PushDispatchIntegrationConsumer(
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PushDispatchIntegrationConsumer> logger)
    : InboxIntegrationEventConsumer(scopeFactory, options.Value, logger)
{
    protected override string QueueName => "platform.push-dispatch";

    protected override string ConsumerName => "platform.push";

    protected override string LogName => "Push dispatch";

    protected override Task BindAsync(IChannel channel, CancellationToken cancellationToken) =>
        channel.QueueBindAsync(
            QueueName,
            Options.Exchange,
            IntegrationEventTypes.NotificationUserCreated,
            cancellationToken: cancellationToken);

    protected override async Task HandleAsync(
        IServiceProvider services,
        string json,
        CancellationToken cancellationToken)
    {
        var envelope = JsonSerializer.Deserialize<IntegrationEventEnvelope<NotificationUserCreatedPayload>>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (envelope?.Payload is null)
            return;

        var handler = services.GetRequiredService<WebPushDeliveryHandler>();
        await handler.DeliverAsync(envelope.Payload, cancellationToken);
    }
}
