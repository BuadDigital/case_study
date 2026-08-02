using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Platform.Api.Integration;

/// <summary>
/// Durable shared consumer that delivers Web Push for each persisted user notification.
/// Distinct inbox consumer name from SSE fan-out so both process the same event.
/// </summary>
public sealed class PushDispatchIntegrationConsumer : BackgroundService
{
    private const string QueueName = "platform.push-dispatch";
    private const string ConsumerName = "platform.push";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RabbitMqOptions _options;
    private readonly ILogger<PushDispatchIntegrationConsumer> _logger;

    public PushDispatchIntegrationConsumer(
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<PushDispatchIntegrationConsumer> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunConsumerAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Push dispatch consumer disconnected; retrying in 5s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task RunConsumerAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("RabbitMQ disabled; push dispatch consumer idle");
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
            return;
        }

        var factory = new ConnectionFactory
        {
            HostName = _options.Host,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
        };

        await using var connection = await factory.CreateConnectionAsync(stoppingToken);
        await using var channel = await RabbitMqTopology.CreateConsumerChannelAsync(
            connection,
            _options,
            QueueName,
            _logger,
            stoppingToken);

        await channel.QueueBindAsync(
            QueueName,
            _options.Exchange,
            IntegrationEventTypes.NotificationUserCreated,
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, args) =>
        {
            await HandleAsync(channel, args, stoppingToken);
        };

        await channel.BasicConsumeAsync(
            QueueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: stoppingToken);

        _logger.LogInformation("Push dispatch listening on queue {Queue}", QueueName);
        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
    }

    private async Task HandleAsync(
        IChannel channel,
        BasicDeliverEventArgs args,
        CancellationToken stoppingToken)
    {
        var json = Encoding.UTF8.GetString(args.Body.ToArray());
        if (!IntegrationEventEnvelopeReader.TryReadMetadata(json, out var eventId, out var eventType))
        {
            await channel.BasicNackAsync(args.DeliveryTag, multiple: false, requeue: false, stoppingToken);
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var inbox = scope.ServiceProvider.GetRequiredService<IIntegrationEventInbox>();
        if (!await inbox.TryBeginAsync(ConsumerName, eventId, eventType, stoppingToken))
        {
            await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
            return;
        }

        try
        {
            var envelope = JsonSerializer.Deserialize<IntegrationEventEnvelope<NotificationUserCreatedPayload>>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (envelope?.Payload is null)
            {
                await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
                return;
            }

            var handler = scope.ServiceProvider.GetRequiredService<WebPushDeliveryHandler>();
            await handler.DeliverAsync(envelope.Payload, stoppingToken);
            await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
        }
        catch (Exception ex)
        {
            try
            {
                using var releaseScope = _scopeFactory.CreateScope();
                await releaseScope.ServiceProvider
                    .GetRequiredService<IIntegrationEventInbox>()
                    .ReleaseAsync(ConsumerName, eventId, stoppingToken);
            }
            catch (Exception releaseEx)
            {
                _logger.LogError(releaseEx, "Could not release push inbox claim for {EventId}", eventId);
            }

            var retry = !args.Redelivered;
            _logger.LogError(
                ex,
                "Push dispatch failed for {EventId}; {Action}",
                eventId,
                retry ? "requeuing once" : "dead-lettering");
            await channel.BasicNackAsync(args.DeliveryTag, multiple: false, retry, stoppingToken);
        }
    }
}
