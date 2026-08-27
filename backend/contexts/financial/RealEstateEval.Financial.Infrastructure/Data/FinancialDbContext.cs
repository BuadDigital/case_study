using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Financial bounded context.
/// Maps the <c>financial</c> schema plus D1 inspector-fee tables still physically in
/// <c>case_study</c>.
/// </summary>
public sealed class FinancialDbContext(DbContextOptions<FinancialDbContext> options)
    : DbContext(options)
{
    public DbSet<PartyBillingStatement> PartyBillingStatements => Set<PartyBillingStatement>();
    public DbSet<PartyBillingStatementLine> PartyBillingStatementLines =>
        Set<PartyBillingStatementLine>();
    public DbSet<PoEnfazRevenueLine> PoEnfazRevenueLines => Set<PoEnfazRevenueLine>();
    public DbSet<PoEnfazInvoice> PoEnfazInvoices => Set<PoEnfazInvoice>();
    public DbSet<PoEnfazFollowup> PoEnfazFollowups => Set<PoEnfazFollowup>();
    public DbSet<PoEnfazFinanceFlag> PoEnfazFinanceFlags => Set<PoEnfazFinanceFlag>();
    public DbSet<KeyReceiptFeeCharge> KeyReceiptFeeCharges => Set<KeyReceiptFeeCharge>();
    public DbSet<CourtVisitFeeCharge> CourtVisitFeeCharges => Set<CourtVisitFeeCharge>();
    public DbSet<FinancialReportConfig> FinancialReportConfigs => Set<FinancialReportConfig>();
    public DbSet<PartyFeePricingTable> PartyFeePricingTables => Set<PartyFeePricingTable>();
    public DbSet<PartyFeePricingTier> PartyFeePricingTiers => Set<PartyFeePricingTier>();
    public DbSet<PartyFeePricingAssignment> PartyFeePricingAssignments =>
        Set<PartyFeePricingAssignment>();
    public DbSet<IncentiveSuspension> IncentiveSuspensions => Set<IncentiveSuspension>();
    public DbSet<DiscountFlag> DiscountFlags => Set<DiscountFlag>();
    public DbSet<InspectorFeeLedger> InspectorFeeLedgers => Set<InspectorFeeLedger>();
    public DbSet<InspectorFeeTransition> InspectorFeeTransitions => Set<InspectorFeeTransition>();
    public DbSet<DisbursementBatch> DisbursementBatches => Set<DisbursementBatch>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder
            .ApplyFinancialModel()
            .ApplyAuditModel(ownsMigrations: false);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampInspectorFeeLedgerIdentity();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        StampInspectorFeeLedgerIdentity();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

 /// <summary>
 /// Fills identity columns when callers still construct ledgers with only WorkflowTaskId /
 /// PropertyId / AssigneeId (tests and transitional paths). Also stamps NetFeeSar / PaidAmountSar.
 /// </summary>
    private void StampInspectorFeeLedgerIdentity()
    {
        foreach (var entry in ChangeTracker.Entries<InspectorFeeLedger>())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
                continue;

            var ledger = entry.Entity;
            if (ledger.Id == Guid.Empty)
                ledger.Id = Guid.NewGuid();
            if (string.IsNullOrWhiteSpace(ledger.UserId))
                ledger.UserId = ledger.AssigneeId?.Trim() ?? "";
            if (ledger.DeedId == Guid.Empty)
                ledger.DeedId = ledger.PropertyId ?? ledger.WorkflowTaskId;
            if (ledger.TransactionId == Guid.Empty)
            {
                var po = ledger.PoNumber?.Trim() ?? "";
                ledger.TransactionId = string.IsNullOrEmpty(po)
                    ? ledger.WorkflowTaskId
                    : StableGuidFromKey($"tx:{po}");
            }

            ledger.NetFeeSar = Math.Max(
                0m,
                ledger.AgreedFeeSar - Math.Max(0m, ledger.SupervisorDiscountSar));
            if (string.Equals(
                    ledger.BillingStatus,
                    InspectorFeeBillingStatus.Disbursed,
                    StringComparison.OrdinalIgnoreCase))
                ledger.PaidAmountSar = ledger.NetFeeSar;
        }
    }

    private static Guid StableGuidFromKey(string key)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(key));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }
}
