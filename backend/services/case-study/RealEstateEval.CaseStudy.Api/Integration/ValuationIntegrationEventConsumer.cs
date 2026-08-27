using System.Text;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Infrastructure.Integration;

namespace RealEstateEval.CaseStudy.Api.Integration;

/// <summary>Consumes valuation report events and updates case-study workflow.</summary>
public sealed class ValuationIntegrationEventConsumer : BackgroundService
{
    private const string QueueName = "case-study.valuation-events";

 /// <summary>Inbox key — distinct from other consumers of the same events.</summary>
    private const string ConsumerName = "case-study.valuation";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RabbitMqOptions _options;
    private readonly ILogger<ValuationIntegrationEventConsumer> _logger;

    public ValuationIntegrationEventConsumer(
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<ValuationIntegrationEventConsumer> logger)
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
                _logger.LogWarning(ex, "Valuation consumer disconnected; retrying in 5s");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task RunConsumerAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("RabbitMQ disabled; valuation consumer idle");
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
            routingKey: IntegrationEventTypes.ValuationReportSubmitted,
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, args) =>
            await HandleDeliveryAsync(channel, args, stoppingToken);

        await channel.BasicConsumeAsync(
            QueueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: stoppingToken);

        _logger.LogInformation(
            "Valuation integration consumer listening for {ReportEvent}",
            IntegrationEventTypes.ValuationReportSubmitted);

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
            _logger.LogError("Discarding unreadable valuation event to the dead-letter queue");
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
            var reportHandler = scope.ServiceProvider
                .GetRequiredService<ValuationReportWorkflowHandler>();
            await reportHandler.HandleEnvelopeAsync(json, stoppingToken);
            await channel.BasicAckAsync(args.DeliveryTag, multiple: false, stoppingToken);
        }
        catch (Exception ex)
        {
            await ReleaseClaimAsync(eventId, stoppingToken);

 // One retry, then the message dead-letters rather than cycling forever.
            var retry = !args.Redelivered;
            _logger.LogError(
                ex,
                "Failed to handle valuation event {EventId}; {Action}",
                eventId,
                retry ? "requeuing once" : "dead-lettering");

            await channel.BasicNackAsync(args.DeliveryTag, multiple: false, retry, stoppingToken);
        }
    }

 /// <summary>
 /// Frees the inbox claim in its own scope, because the failed scope's context may still
 /// hold the changes that could not be saved.
 /// </summary>
    private async Task ReleaseClaimAsync(Guid eventId, CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            await scope.ServiceProvider
                .GetRequiredService<IIntegrationEventInbox>()
                .ReleaseAsync(ConsumerName, eventId, stoppingToken);
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
