using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// The legacy shared context (ADR 0003). It still holds every slice that Phase 1 has not
/// extracted yet, plus the mappings of already-extracted tables that non-owner slices keep
/// reading until plan Phase 3 replaces those reads with owner APIs and projections. Extracted
/// tables are configured from the owner's model definition, so the two mappings cannot drift,
/// and no new mapping may be added here.
/// <para>
/// It still inherits ASP.NET Identity's store context so transitional Identity reads keep a
/// complete model (keys, indexes). The write path is <see cref="IdentityDbContext"/> via
/// <c>AddEntityFrameworkStores</c>; this class must not be registered as the Identity store.
/// </para>
/// </summary>
public class ApplicationDbContext : IdentityDbContext<ApplicationUser>, IOutboxContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options): base(options) {}
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<HrEmployeeProfile> HrEmployeeProfiles => Set<HrEmployeeProfile>();
    public DbSet<ProcServiceProviderProfile> ProcServiceProviderProfiles => Set<ProcServiceProviderProfile>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderProperty> WorkOrderProperties => Set<WorkOrderProperty>();
    public DbSet<PropertyContact> PropertyContacts => Set<PropertyContact>();
    public DbSet<CourtCatalogEntry> CourtCatalogEntries => Set<CourtCatalogEntry>();
    public DbSet<Court> Courts => Set<Court>();
    public DbSet<CourtCircuit> CourtCircuits => Set<CourtCircuit>();
    public DbSet<CourtAuditLog> CourtAuditLogs => Set<CourtAuditLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Region> Regions => Set<Region>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<WorkflowTask> WorkflowTasks => Set<WorkflowTask>();
    public DbSet<CaseStudyForm> CaseStudyForms => Set<CaseStudyForm>();
    public DbSet<CaseStudyInfoRolesConfig> CaseStudyInfoRolesConfigs => Set<CaseStudyInfoRolesConfig>();
    public DbSet<PartyTaskSubmission> PartyTaskSubmissions => Set<PartyTaskSubmission>();
    public DbSet<FieldInspectionWorkspace> FieldInspectionWorkspaces => Set<FieldInspectionWorkspace>();
    public DbSet<InspectorFeeLedger> InspectorFeeLedgers => Set<InspectorFeeLedger>();
    public DbSet<InspectorFeeTransition> InspectorFeeTransitions => Set<InspectorFeeTransition>();
    public DbSet<DisbursementBatch> DisbursementBatches => Set<DisbursementBatch>();
    public DbSet<PartyBillingStatement> PartyBillingStatements => Set<PartyBillingStatement>();
    public DbSet<PartyBillingStatementLine> PartyBillingStatementLines => Set<PartyBillingStatementLine>();
    public DbSet<PoEnfazRevenueLine> PoEnfazRevenueLines => Set<PoEnfazRevenueLine>();
    public DbSet<PoEnfazInvoice> PoEnfazInvoices => Set<PoEnfazInvoice>();
    public DbSet<PropertyFailure> PropertyFailures => Set<PropertyFailure>();
    public DbSet<PropertyTimelineEntry> PropertyTimelineEntries => Set<PropertyTimelineEntry>();
    public DbSet<FieldDictionaryConfig> FieldDictionaryConfigs => Set<FieldDictionaryConfig>();
    public DbSet<FailureTypesCatalogConfig> FailureTypesCatalogConfigs => Set<FailureTypesCatalogConfig>();
    public DbSet<SurveyOffice> SurveyOffices => Set<SurveyOffice>();
    public DbSet<ValuationRequest> ValuationRequests => Set<ValuationRequest>();
    public DbSet<PropertyKeyRecord> PropertyKeyRecords => Set<PropertyKeyRecord>();
    public DbSet<KeyEnvelope> KeyEnvelopes => Set<KeyEnvelope>();
    public DbSet<KeyEnvelopeAssignment> KeyEnvelopeAssignments => Set<KeyEnvelopeAssignment>();
    public DbSet<KeyEnvelopeHandoff> KeyEnvelopeHandoffs => Set<KeyEnvelopeHandoff>();
    public DbSet<KeyEnvelopeTimelineEntry> KeyEnvelopeTimelineEntries => Set<KeyEnvelopeTimelineEntry>();
    public DbSet<PropertyCourtAccess> PropertyCourtAccesses => Set<PropertyCourtAccess>();
    public DbSet<KeyReceiptFeeCharge> KeyReceiptFeeCharges => Set<KeyReceiptFeeCharge>();
    public DbSet<CourtVisitFeeCharge> CourtVisitFeeCharges => Set<CourtVisitFeeCharge>();
    public DbSet<FileAttachment> FileAttachments => Set<FileAttachment>();
    public DbSet<InternalDelegationLetterSet> InternalDelegationLetterSets => Set<InternalDelegationLetterSet>();
    public DbSet<OperationsTask> OperationsTasks => Set<OperationsTask>();
    public DbSet<OperationsTaskSequence> OperationsTaskSequences => Set<OperationsTaskSequence>();
    public DbSet<DocumentReferenceCounter> DocumentReferenceCounters => Set<DocumentReferenceCounter>();
    public DbSet<EvaluatorRecallRecord> EvaluatorRecallRecords => Set<EvaluatorRecallRecord>();
    public DbSet<PoIntakeDraft> PoIntakeDrafts => Set<PoIntakeDraft>();
    public DbSet<FinancialReportConfig> FinancialReportConfigs => Set<FinancialReportConfig>();
    public DbSet<PartyFeePricingTable> PartyFeePricingTables => Set<PartyFeePricingTable>();
    public DbSet<PartyFeePricingTier> PartyFeePricingTiers => Set<PartyFeePricingTier>();
    public DbSet<PartyFeePricingAssignment> PartyFeePricingAssignments => Set<PartyFeePricingAssignment>();
    public DbSet<IncentiveSuspension> IncentiveSuspensions => Set<IncentiveSuspension>();
    public DbSet<DiscountFlag> DiscountFlags => Set<DiscountFlag>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<ProcessedIntegrationEvent> ProcessedIntegrationEvents =>
        Set<ProcessedIntegrationEvent>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<PushPreference> PushPreferences => Set<PushPreference>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Slices already extracted in Phase 1. Their owner context is the write path; these
        // mappings only keep the remaining cross-boundary reads compiling and are removed
        // with those reads in Phase 3.
        builder
            .ApplyIdentityModel()
            .ApplyAttachmentsModel()
            .ApplyPlatformModel(ownsMigrations: false)
            .ApplyValuationModel()
            .ApplyFailuresModel(ownsMigrations: false)
            .ApplyOperationsModel(ownsMigrations: false)
            .ApplyFinancialModel(ownsMigrations: false)
            .ApplyCaseStudyModel(ownsMigrations: false)
            .ApplyAuditModel(ownsMigrations: false)
            .ApplyOutboxModel(ownsMigrations: false)
            .ApplyInboxModel(ownsMigrations: false)
            .ApplyNotificationModel(ownsMigrations: false);
    }

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
    /// Fills ج٨ identity columns when callers still construct ledgers with only WorkflowTaskId /
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
