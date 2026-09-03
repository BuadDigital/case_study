using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Valuation bounded context.
/// <para>
/// It also maps <c>messaging.OutboxMessages</c>: <c>ValuationRequestService</c> publishes an
/// integration event in the same unit of work as the request it writes, and the outbox is per-producer,
/// so the rows Valuation raises must be reachable from Valuation's
/// own context. It owns only the rows it inserts.
/// </para>
/// </summary>
public sealed class ValuationDbContext(DbContextOptions<ValuationDbContext> options)
    : DbContext(options), IOutboxContext
{
    public DbSet<ValuationRequest> ValuationRequests => Set<ValuationRequest>();
    public DbSet<ComparableProperty> ComparableProperties => Set<ComparableProperty>();
    public DbSet<PropertyComparableLink> PropertyComparableLinks => Set<PropertyComparableLink>();
    public DbSet<ValuationComparableSelection> ValuationComparableSelections =>
        Set<ValuationComparableSelection>();
    public DbSet<ValuationReportIssuance> ValuationReportIssuances =>
        Set<ValuationReportIssuance>();
    public DbSet<ValuationAdjustmentFactorRationale> ValuationAdjustmentFactorRationales =>
        Set<ValuationAdjustmentFactorRationale>();
    public DbSet<ValuationComparableAdjustmentLine> ValuationComparableAdjustmentLines =>
        Set<ValuationComparableAdjustmentLine>();
    public DbSet<ValuationMarketApproach> ValuationMarketApproaches => Set<ValuationMarketApproach>();
    public DbSet<ValuationApproachSettings> ValuationApproachSettings => Set<ValuationApproachSettings>();
    public DbSet<ValuationCostApproach> ValuationCostApproaches => Set<ValuationCostApproach>();
    public DbSet<ValuationCostLine> ValuationCostLines => Set<ValuationCostLine>();
    public DbSet<ValuationIndirectCostItem> ValuationIndirectCostItems => Set<ValuationIndirectCostItem>();
    public DbSet<ValuationReconciliation> ValuationReconciliations => Set<ValuationReconciliation>();
    public DbSet<ValuationReconciliationMethodLine> ValuationReconciliationMethodLines =>
        Set<ValuationReconciliationMethodLine>();
    public DbSet<EvaluatorRecallRecord> EvaluatorRecallRecords => Set<EvaluatorRecallRecord>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder
            .ApplyValuationModel()
            .ApplyOutboxModel(ownsMigrations: false);
}
