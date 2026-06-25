using System.Text;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Platform.Api.Integration;

/// <summary>Consumes integration events and creates per-user notifications.</summary>
public sealed class NotificationIntegrationEventConsumer : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RabbitMqOptions _options;
    private readonly ILogger<NotificationIntegrationEventConsumer> _logger;

    public NotificationIntegrationEventConsumer(
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<NotificationIntegrationEventConsumer> logger)
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
                _logger.LogWarning(ex, "Notification consumer disconnected; retrying in 5s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task RunConsumerAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("RabbitMQ disabled; notification consumer idle");
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
        await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

        await channel.ExchangeDeclareAsync(
            _options.Exchange,
            ExchangeType.Topic,
            durable: true,
            cancellationToken: stoppingToken);

        var queue = await channel.QueueDeclareAsync(
            "platform.notification-events",
            durable: true,
            exclusive: false,
            autoDelete: false,
            cancellationToken: stoppingToken);

        await channel.QueueBindAsync(
            queue.QueueName,
            _options.Exchange,
            routingKey: IntegrationEventTypes.ValuationReportSubmitted,
            cancellationToken: stoppingToken);

        await channel.QueueBindAsync(
            queue.QueueName,
            _options.Exchange,
            routingKey: IntegrationEventTypes.ValuationRequestCreated,
            cancellationToken: stoppingToken);

        await channel.QueueBindAsync(
            queue.QueueName,
            _options.Exchange,
            routingKey: IntegrationEventTypes.NotificationUserCreated,
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, args) =>
        {
            var json = Encoding.UTF8.GetString(args.Body.ToArray());
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var domainHandler = scope.ServiceProvider
                    .GetRequiredService<NotificationIntegrationEventHandler>();
                var pushHandler = scope.ServiceProvider
                    .GetRequiredService<NotificationRealtimePushHandler>();
                await domainHandler.HandleEnvelopeAsync(json, stoppingToken);
                await pushHandler.HandleEnvelopeAsync(json, stoppingToken);
                await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to handle notification event; nacking");
                await channel.BasicNackAsync(
                    args.DeliveryTag,
                    multiple: false,
                    requeue: true,
                    stoppingToken);
            }
        };

        await channel.BasicConsumeAsync(
            queue.QueueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: stoppingToken);

        _logger.LogInformation("Notification integration consumer listening on {Queue}", queue.QueueName);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // shutdown
        }
    }
}
