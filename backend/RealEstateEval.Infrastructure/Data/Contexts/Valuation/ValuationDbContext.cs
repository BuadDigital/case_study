using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Valuation bounded context (plan Phase 1, extraction order step 1).
/// <para>
/// It also maps <c>messaging.OutboxMessages</c>: <c>ValuationRequestService</c> publishes an
/// integration event in the same unit of work as the request it writes, and decision D5 makes
/// the outbox per-producer, so the rows Valuation raises must be reachable from Valuation's
/// own context. It owns only the rows it inserts.
/// </para>
/// </summary>
public sealed class ValuationDbContext(DbContextOptions<ValuationDbContext> options)
    : DbContext(options), IOutboxContext
{
    public DbSet<ValuationRequest> ValuationRequests => Set<ValuationRequest>();
    public DbSet<EvaluatorRecallRecord> EvaluatorRecallRecords => Set<EvaluatorRecallRecord>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder
            .ApplyValuationModel()
            .ApplyOutboxModel(ownsMigrations: false);
}
