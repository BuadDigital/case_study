using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Shared consumer topology: a durable work queue whose rejected messages are routed to a
/// matching dead-letter queue instead of being requeued forever.
/// </summary>
public static class RabbitMqTopology
{
    /// <summary>Messages in flight per consumer. Keeps one replica from draining the queue.</summary>
    private const ushort PrefetchCount = 20;

    private const int PreconditionFailed = 406;

    public static string DeadLetterExchangeName(RabbitMqOptions options) =>
        options.Exchange + ".dead-letter";

    public static string DeadLetterQueueName(string queueName) => queueName + ".dead-letter";

    /// <summary>
    /// Opens a channel and declares the exchange, work queue, and dead-letter chain.
    /// </summary>
    /// <remarks>
    /// RabbitMQ treats queue arguments as immutable, so a queue created before dead-lettering
    /// existed cannot be redeclared with it. Rather than crash the consumer on startup, that
    /// case falls back to the original declaration and warns; deleting the queue once lets
    /// dead-lettering take effect.
    /// </remarks>
    public static async Task<IChannel> CreateConsumerChannelAsync(
        IConnection connection,
        RabbitMqOptions options,
        string queueName,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);

        await channel.ExchangeDeclareAsync(
            options.Exchange,
            ExchangeType.Topic,
            durable: true,
            cancellationToken: cancellationToken);

        var deadLetterExchange = DeadLetterExchangeName(options);
        var deadLetterQueue = DeadLetterQueueName(queueName);

        await channel.ExchangeDeclareAsync(
            deadLetterExchange,
            ExchangeType.Direct,
            durable: true,
            cancellationToken: cancellationToken);

        await channel.QueueDeclareAsync(
            deadLetterQueue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            cancellationToken: cancellationToken);

        await channel.QueueBindAsync(
            deadLetterQueue,
            deadLetterExchange,
            routingKey: queueName,
            cancellationToken: cancellationToken);

        try
        {
            await channel.QueueDeclareAsync(
                queueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: new Dictionary<string, object?>
                {
                    ["x-dead-letter-exchange"] = deadLetterExchange,
                    ["x-dead-letter-routing-key"] = queueName,
                },
                cancellationToken: cancellationToken);
        }
        catch (OperationInterruptedException ex)
            when (ex.ShutdownReason?.ReplyCode == PreconditionFailed)
        {
            logger.LogWarning(
                "Queue {Queue} exists without dead-lettering; delete it to enable the "
                + "dead-letter queue {DeadLetterQueue}",
                queueName,
                deadLetterQueue);

            await channel.DisposeAsync();
            channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
            await channel.QueueDeclareAsync(
                queueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                cancellationToken: cancellationToken);
        }

        await channel.BasicQosAsync(
            prefetchSize: 0,
            prefetchCount: PrefetchCount,
            global: false,
            cancellationToken: cancellationToken);

        return channel;
    }
}
