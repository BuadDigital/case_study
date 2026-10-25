using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Platform.Infrastructure.Integration;

namespace RealEstateEval.Platform.Api.Integration;

/// <summary>Consumes integration events and creates per-user notifications.</summary>
public sealed class NotificationIntegrationEventConsumer(
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<NotificationIntegrationEventConsumer> logger)
    : InboxIntegrationEventConsumer(scopeFactory, options.Value, logger)
{
    protected override string QueueName => "platform.notification-events";

    protected override string ConsumerName => "platform.notifications";

    protected override string LogName => "Notification";

    protected override async Task BindAsync(IChannel channel, CancellationToken cancellationToken)
    {
 // Older deployments bound created events to this shared work queue. Realtime now
 // uses per-process fan-out queues, so remove the stale durable binding on upgrade.
        await channel.QueueUnbindAsync(
            QueueName,
            Options.Exchange,
            IntegrationEventTypes.NotificationUserCreated,
            cancellationToken: cancellationToken);

        foreach (var routingKey in NotificationIntegrationEventHandler.HandledEventTypes)
        {
            await channel.QueueBindAsync(
                QueueName,
                Options.Exchange,
                routingKey: routingKey,
                cancellationToken: cancellationToken);
        }
    }

    protected override Task HandleAsync(
        IServiceProvider services,
        string json,
        CancellationToken cancellationToken) =>
        services.GetRequiredService<NotificationIntegrationEventHandler>()
            .HandleEnvelopeAsync(json, cancellationToken);
}
