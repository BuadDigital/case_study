using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// A durable shared work-queue consumer that applies each event once through the inbox. An
/// unreadable message dead-letters, a duplicate is acked, and a failed handler frees its claim
/// and is requeued once before it dead-letters. A dropped connection reconnects after 5s.
/// </summary>
public abstract class InboxIntegrationEventConsumer : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    protected InboxIntegrationEventConsumer(
        IServiceScopeFactory scopeFactory,
        RabbitMqOptions options,
        ILogger logger)
    {
        _scopeFactory = scopeFactory;
        Options = options;
        _logger = logger;
    }

    protected RabbitMqOptions Options { get; }

    protected abstract string QueueName { get; }

 /// <summary>Inbox key — distinct from other consumers of the same events.</summary>
    protected abstract string ConsumerName { get; }

 /// <summary>Names the consumer in its log lines, e.g. "Notification".</summary>
    protected abstract string LogName { get; }

 /// <summary>Binds <see cref="QueueName"/> to the event types this consumer handles.</summary>
    protected abstract Task BindAsync(IChannel channel, CancellationToken cancellationToken);

 /// <summary>Applies one claimed envelope inside its delivery scope; returning normally acks it.</summary>
    protected abstract Task HandleAsync(
        IServiceProvider services,
        string json,
        CancellationToken cancellationToken);

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
                _logger.LogWarning(ex, "{Consumer} consumer disconnected; retrying in 5s", LogName);
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task RunConsumerAsync(CancellationToken stoppingToken)
    {
        if (!Options.Enabled)
        {
            _logger.LogInformation("RabbitMQ disabled; {Consumer} consumer idle", LogName.ToLowerInvariant());
            await Task.Delay(Timeout.InfiniteTimeSpan, stoppingToken);
            return;
        }

        await using var connection = await RabbitMqTopology.CreateConnectionFactory(Options)
            .CreateConnectionAsync(stoppingToken);
        await using var channel = await RabbitMqTopology.CreateConsumerChannelAsync(
            connection,
            Options,
            QueueName,
            _logger,
            stoppingToken);

        await BindAsync(channel, stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, args) =>
            await HandleDeliveryAsync(channel, args, stoppingToken);

        await channel.BasicConsumeAsync(
            QueueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: stoppingToken);

        _logger.LogInformation("{Consumer} integration consumer listening on {Queue}", LogName, QueueName);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
 // shutdown
        }
    }

    private async Task HandleDeliveryAsync(
        IChannel channel,
        BasicDeliverEventArgs args,
        CancellationToken stoppingToken)
    {
        var json = Encoding.UTF8.GetString(args.Body.ToArray());

        if (!IntegrationEventEnvelopeReader.TryReadMetadata(json, out var eventId, out var eventType))
        {
 // Unreadable messages will never succeed, so dead-letter instead of looping.
            _logger.LogError(
                "Discarding unreadable {Consumer} event to the dead-letter queue",
                LogName.ToLowerInvariant());
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
            await HandleAsync(scope.ServiceProvider, json, stoppingToken);
            await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
        }
        catch (Exception ex)
        {
            await ReleaseClaimAsync(eventId);

 // One retry, then the message dead-letters rather than cycling forever.
            var retry = !args.Redelivered;
            _logger.LogError(
                ex,
                "Failed to handle {Consumer} event {EventId}; {Action}",
                LogName.ToLowerInvariant(),
                eventId,
                retry ? "requeuing once" : "dead-lettering");

            await channel.BasicNackAsync(args.DeliveryTag, multiple: false, retry, stoppingToken);
        }
    }

 /// <summary>
 /// Frees the inbox claim in its own scope, because the failed scope's context may still
 /// hold the changes that could not be saved.
 /// </summary>
    private async Task ReleaseClaimAsync(Guid eventId)
    {
        // Not the stopping token: a handler cancelled by shutdown (e.g. a rolling deploy) must
        // still free its claim, or the redelivered message is skipped as a duplicate.
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try
        {
            using var scope = _scopeFactory.CreateScope();
            await scope.ServiceProvider
                .GetRequiredService<IIntegrationEventInbox>()
                .ReleaseAsync(ConsumerName, eventId, timeout.Token);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Could not release inbox claim for {EventId}; a retry will be skipped as duplicate",
                eventId);
        }
    }
}
