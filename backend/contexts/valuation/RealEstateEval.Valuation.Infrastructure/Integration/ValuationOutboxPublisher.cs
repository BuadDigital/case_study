using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>Outbox writer owned by the Valuation context (A8: lives beside its context).</summary>
public sealed class ValuationOutboxPublisher(
    ValuationDbContext db,
    ILogger<ValuationOutboxPublisher> logger,
    TimeProvider? time = null)
    : OutboxIntegrationEventPublisher<ValuationDbContext>(db, logger, time), IValuationEventPublisher;
