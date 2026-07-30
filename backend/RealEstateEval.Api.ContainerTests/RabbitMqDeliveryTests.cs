using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RealEstateEval.Infrastructure.Integration;
using Testcontainers.RabbitMq;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// The outbox dispatcher's delivery guarantees rest on the broker topology declared in
/// <see cref="RabbitMqTopology"/> — a topic exchange plus a dead-letter chain. Only a real broker
/// can confirm the declarations are accepted and that a rejected message lands in its
/// dead-letter queue instead of being requeued forever.
/// </summary>
public class RabbitMqDeliveryTests : IAsyncLifetime
{
    private const string QueueName = "container-tests.work";
    private const string RoutingKey = "valuation.request.created.v1";

    private RabbitMqContainer? _container;
    private RabbitMqOptions? _options;

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable)
            return;

        _container = new RabbitMqBuilder("rabbitmq:3.13-alpine")
            .WithUsername("container-tests")
            .WithPassword("container-tests-password")
            .Build();

        await _container.StartAsync();

        var uri = new Uri(_container.GetConnectionString());
        _options = new RabbitMqOptions
        {
            Host = uri.Host,
            Port = uri.Port,
            UserName = "container-tests",
            Password = "container-tests-password",
            Exchange = "container-tests.events",
        };
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
            await _container.DisposeAsync();
    }

    [DockerFact]
    public async Task Published_events_reach_a_consumer_bound_to_the_topic_exchange()
    {
        var options = Options();
        await using var connection = await CreateConnectionAsync(options);
        await using var channel = await RabbitMqTopology.CreateConsumerChannelAsync(
            connection,
            options,
            QueueName,
            NullLogger.Instance,
            CancellationToken.None);

        await channel.QueueBindAsync(QueueName, options.Exchange, RoutingKey);

        var received = new TaskCompletionSource<string>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, args) =>
        {
            received.TrySetResult(Encoding.UTF8.GetString(args.Body.ToArray()));
            return Task.CompletedTask;
        };
        await channel.BasicConsumeAsync(QueueName, autoAck: true, consumer);

        using var publisher = new RabbitMqMessagePublisher(
            new OptionsWrapper<RabbitMqOptions>(options),
            NullLogger<RabbitMqMessagePublisher>.Instance);

        Assert.True(await publisher.PublishAsync(RoutingKey, """{"id":"container-test"}"""));

        var body = await WithTimeoutAsync(received.Task);
        Assert.Contains("container-test", body);
    }

    [DockerFact]
    public async Task A_rejected_message_lands_in_the_dead_letter_queue()
    {
        var options = Options();
        await using var connection = await CreateConnectionAsync(options);
        await using var channel = await RabbitMqTopology.CreateConsumerChannelAsync(
            connection,
            options,
            QueueName + ".rejecting",
            NullLogger.Instance,
            CancellationToken.None);

        var queueName = QueueName + ".rejecting";
        await channel.QueueBindAsync(queueName, options.Exchange, RoutingKey);

        using var publisher = new RabbitMqMessagePublisher(
            new OptionsWrapper<RabbitMqOptions>(options),
            NullLogger<RabbitMqMessagePublisher>.Instance);
        Assert.True(await publisher.PublishAsync(RoutingKey, """{"id":"poison"}"""));

        var delivered = await WithTimeoutAsync(GetOneAsync(channel, queueName));
        await channel.BasicRejectAsync(delivered.DeliveryTag, requeue: false);

        var deadLetterQueue = RabbitMqTopology.DeadLetterQueueName(queueName);
        var deadLettered = await WithTimeoutAsync(GetOneAsync(channel, deadLetterQueue));

        Assert.Contains("poison", Encoding.UTF8.GetString(deadLettered.Body.ToArray()));
    }

    [DockerFact]
    public async Task A_disabled_broker_reports_the_publish_as_undelivered()
    {
        var options = Options();
        options.Enabled = false;

        using var publisher = new RabbitMqMessagePublisher(
            new OptionsWrapper<RabbitMqOptions>(options),
            NullLogger<RabbitMqMessagePublisher>.Instance);

        Assert.False(await publisher.PublishAsync(RoutingKey, "{}"));
    }

    private RabbitMqOptions Options()
    {
        var options = _options ?? throw new InvalidOperationException("Broker is not running.");
        return new RabbitMqOptions
        {
            Host = options.Host,
            Port = options.Port,
            UserName = options.UserName,
            Password = options.Password,
            VirtualHost = options.VirtualHost,
            Exchange = options.Exchange,
            Enabled = true,
        };
    }

    private static Task<IConnection> CreateConnectionAsync(RabbitMqOptions options) =>
        new ConnectionFactory
        {
            HostName = options.Host,
            Port = options.Port,
            UserName = options.UserName,
            Password = options.Password,
            VirtualHost = options.VirtualHost,
        }.CreateConnectionAsync();

    /// <summary>Polls with <c>BasicGet</c> because delivery and dead-lettering are asynchronous.</summary>
    private static async Task<BasicGetResult> GetOneAsync(IChannel channel, string queueName)
    {
        while (true)
        {
            var result = await channel.BasicGetAsync(queueName, autoAck: false);
            if (result is not null)
                return result;

            await Task.Delay(50);
        }
    }

    private static async Task<T> WithTimeoutAsync<T>(Task<T> task)
    {
        var completed = await Task.WhenAny(task, Task.Delay(TimeSpan.FromSeconds(30)));
        Assert.Same(task, completed);
        return await task;
    }
}
