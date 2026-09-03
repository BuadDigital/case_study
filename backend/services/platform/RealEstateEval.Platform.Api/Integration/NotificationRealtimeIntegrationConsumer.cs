using System.Text;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Platform.Infrastructure.Integration;

namespace RealEstateEval.Platform.Api.Integration;

/// <summary>
/// Per-process RabbitMQ fan-out for SSE. Every Platform replica gets its own exclusive
/// queue, then pushes only to clients connected to that process. Durable inbox persistence
/// remains on the separate shared work queue.
/// </summary>
public sealed class NotificationRealtimeIntegrationConsumer(
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<NotificationRealtimeIntegrationConsumer> logger) : BackgroundService
{
    private readonly RabbitMqOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            logger.LogInformation(
                "RabbitMQ disabled; realtime notification fan-out idle (clients retain polling fallback)");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunConsumerAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Realtime notification fan-out disconnected; retrying in 5s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task RunConsumerAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = _options.Host,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
        };

        await using var connection = await factory.CreateConnectionAsync(stoppingToken);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
        await channel.ExchangeDeclareAsync(
            _options.Exchange,
            ExchangeType.Topic,
            durable: true,
            cancellationToken: stoppingToken);

        var queue = await channel.QueueDeclareAsync(
            queue: "",
            durable: false,
            exclusive: true,
            autoDelete: true,
            cancellationToken: stoppingToken);
        await channel.QueueBindAsync(
            queue.QueueName,
            _options.Exchange,
            IntegrationEventTypes.NotificationUserCreated,
            cancellationToken: stoppingToken);
        await channel.BasicQosAsync(
            prefetchSize: 0,
            prefetchCount: 20,
            global: false,
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, args) =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var handler = scope.ServiceProvider.GetRequiredService<NotificationRealtimePushHandler>();
                await handler.HandleEnvelopeAsync(
                    Encoding.UTF8.GetString(args.Body.ToArray()),
                    stoppingToken);
                await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Realtime notification push failed; dropping frame for polling recovery");
                await channel.BasicNackAsync(
                    args.DeliveryTag,
                    multiple: false,
                    requeue: false,
                    cancellationToken: stoppingToken);
            }
        };

        await channel.BasicConsumeAsync(
            queue.QueueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: stoppingToken);
        logger.LogInformation(
            "Realtime notification fan-out listening on ephemeral queue {Queue}",
            queue.QueueName);

        await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
    }
}
