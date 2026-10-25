using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Infrastructure.Integration;

namespace RealEstateEval.CaseStudy.Api.Integration;

/// <summary>Consumes valuation report events and updates case-study workflow.</summary>
public sealed class ValuationIntegrationEventConsumer(
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<ValuationIntegrationEventConsumer> logger)
    : InboxIntegrationEventConsumer(scopeFactory, options.Value, logger)
{
    protected override string QueueName => "case-study.valuation-events";

    protected override string ConsumerName => "case-study.valuation";

    protected override string LogName => "Valuation";

    protected override Task BindAsync(IChannel channel, CancellationToken cancellationToken) =>
        channel.QueueBindAsync(
            QueueName,
            Options.Exchange,
            routingKey: IntegrationEventTypes.ValuationReportSubmitted,
            cancellationToken: cancellationToken);

    protected override Task HandleAsync(
        IServiceProvider services,
        string json,
        CancellationToken cancellationToken) =>
        services.GetRequiredService<ValuationReportWorkflowHandler>()
            .HandleEnvelopeAsync(json, cancellationToken);
}
