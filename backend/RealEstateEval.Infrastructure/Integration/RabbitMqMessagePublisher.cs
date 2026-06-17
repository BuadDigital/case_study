using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace RealEstateEval.Infrastructure.Integration;

public sealed class RabbitMqMessagePublisher : IDisposable
{
    private readonly RabbitMqOptions _options;
    private readonly ILogger<RabbitMqMessagePublisher> _logger;
    private readonly object _sync = new();
    private IConnection? _connection;
    private IChannel? _channel;

    public RabbitMqMessagePublisher(
        IOptions<RabbitMqOptions> options,
        ILogger<RabbitMqMessagePublisher> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task PublishAsync(
        string routingKey,
        string payloadJson,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            _logger.LogDebug("RabbitMQ disabled; skipped publish {RoutingKey}", routingKey);
            return;
        }

        await EnsureConnectedAsync(cancellationToken);
        if (_channel is null)
        {
            _logger.LogWarning("RabbitMQ unavailable; skipped publish {RoutingKey}", routingKey);
            return;
        }

        var body = Encoding.UTF8.GetBytes(payloadJson);
        await _channel.BasicPublishAsync(
            _options.Exchange,
            routingKey: routingKey,
            body: body,
            cancellationToken: cancellationToken);

        _logger.LogInformation("Published message routingKey={RoutingKey}", routingKey);
    }

    private async Task EnsureConnectedAsync(CancellationToken cancellationToken)
    {
        if (_channel is not null)
            return;

        lock (_sync)
        {
            if (_channel is not null)
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

        var connection = await factory.CreateConnectionAsync(cancellationToken);
        var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);
        await channel.ExchangeDeclareAsync(
            _options.Exchange,
            ExchangeType.Topic,
            durable: true,
            cancellationToken: cancellationToken);

        lock (_sync)
        {
            _connection = connection;
            _channel = channel;
        }
    }

    public void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
    }
}
