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
            .ApplyAuditModel(ownsMigrations: false)
            .ApplyOutboxModel()
            .ApplyInboxModel();

        builder.Entity<WorkOrder>(e =>
        {
            e.ToTable("WorkOrders", DatabaseSchemas.CaseStudy);
            e.UseOptimisticConcurrency();
            e.HasIndex(x => x.PoNumber).IsUnique();
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.AssignmentSpecialist).HasMaxLength(256).IsRequired(false);
            e.Property(x => x.AssignmentSpecialistEmail).HasMaxLength(256).IsRequired(false);
            e.Property(x => x.ReceivedFromEnfathTime).HasMaxLength(8);
            e.Property(x => x.LifecycleStatus).HasMaxLength(32).IsRequired(false);
            e.Property(x => x.PropertiesRegion).HasMaxLength(256).IsRequired(false);
            e.Property(x => x.WorkOrderDescription).HasMaxLength(2000).IsRequired(false);
            e.HasMany(x => x.Properties)
                .WithOne(x => x.WorkOrder)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.CreatedAtUtc);
        });

        builder.Entity<WorkOrderProperty>(e =>
        {
            e.ToTable("WorkOrderProperties", DatabaseSchemas.CaseStudy);
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.RequestNumber).HasMaxLength(64);
            e.Property(x => x.AssignmentMandateNumber).HasMaxLength(64);
            e.Property(x => x.AssignmentMandateDate).HasMaxLength(32);
            e.Property(x => x.RealEstateRegNumber).HasMaxLength(32);
            e.Property(x => x.RealEstateRegDate).HasMaxLength(32);
            e.Property(x => x.DelegationLetterFileName).HasMaxLength(2000);
            e.Property(x => x.OtherDocumentFileNames).HasMaxLength(2000);
            e.Property(x => x.BoundariesAvailability).HasMaxLength(32);
            e.Property(x => x.BoundariesExternalDocName).HasMaxLength(512);
            e.Property(x => x.NorthBoundary).HasMaxLength(512);
            e.Property(x => x.NorthBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.SouthBoundary).HasMaxLength(512);
            e.Property(x => x.SouthBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.EastBoundary).HasMaxLength(512);
            e.Property(x => x.EastBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.WestBoundary).HasMaxLength(512);
            e.Property(x => x.WestBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.RestrictionsPresent).HasMaxLength(8);
            e.Property(x => x.RestrictionType).HasMaxLength(128);
            e.Property(x => x.RestrictionOtherReason).HasMaxLength(500);
            e.Property(x => x.PlanNumber).HasMaxLength(128);
            e.Property(x => x.PlotNumber).HasMaxLength(128);
            e.Property(x => x.LocationMapUrl).HasMaxLength(1024);
            e.Property(x => x.RemovalReason).HasMaxLength(500);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.Region).HasMaxLength(100);
            e.Property(x => x.District).HasMaxLength(128);
            e.Property(x => x.Classification).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.HasIndex(x => x.CourtId);
            e.HasIndex(x => x.CircuitId);
            e.HasIndex(x => x.RegionId);
            e.HasIndex(x => x.CityId);
            e.HasIndex(x => x.RequestNumber);
            e.HasIndex(x => new { x.WorkOrderId, x.DeedNumber });
            e.HasIndex(x => x.DeedNumber);
            e.HasMany(x => x.Contacts)
                .WithOne(x => x.Property)
                .HasForeignKey(x => x.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PropertyContact>(e =>
        {
            e.ToTable("PropertyContacts", DatabaseSchemas.CaseStudy);
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.Role).HasMaxLength(128);
            e.Property(x => x.Phone).HasMaxLength(32);
        });

        builder.Entity<WorkflowTask>(e =>
        {
            e.ToTable("WorkflowTasks", DatabaseSchemas.CaseStudy);
            e.UseOptimisticConcurrency();
            e.Property(x => x.Kind)
                .HasConversion(DomainEnumConverters.WorkflowTaskKind)
                .HasMaxLength(64);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.Title).HasMaxLength(512);
            e.Property(x => x.Phase)
                .HasConversion(DomainEnumConverters.WorkflowTaskPhase)
                .HasMaxLength(32);
            e.Property(x => x.AssigneeRole).HasMaxLength(64);
            e.Property(x => x.AssigneeName).HasMaxLength(256);
            e.Property(x => x.AssigneeId).HasMaxLength(64);
            e.Property(x => x.Status)
                .HasConversion(DomainEnumConverters.WorkflowTaskStatus)
                .HasMaxLength(32);
            e.Property(x => x.DistributionJson).HasColumnType("jsonb");
            e.Property(x => x.ObstructionReason).HasMaxLength(2000);
            e.Property(x => x.ObstructionPriorPhase)
                .HasConversion(DomainEnumConverters.WorkflowTaskPhase)
                .HasMaxLength(32);
            e.Property(x => x.AssignmentType).HasMaxLength(64);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => new { x.PoNumber, x.PropertyOrdinal });
            e.HasIndex(x => new { x.PoNumber, x.PropertyId });
            e.HasIndex(x => x.PropertyId);
            e.HasIndex(x => x.ParentTaskId);
            e.HasIndex(x => new { x.Kind, x.Status });
            e.HasIndex(x => x.CreatedAtUtc);
            // "My tasks" lookups filter on AssigneeId alone in the task, failure, work-order
            // and operations list paths, none of which can use the PoNumber-led indexes.
            e.HasIndex(x => x.AssigneeId);
        });

        builder.Entity<PartyTaskSubmission>(e =>
        {
            e.ToTable("PartyTaskSubmissions", DatabaseSchemas.CaseStudy);
            e.UseOptimisticConcurrency();
            e.Property(x => x.Kind).HasMaxLength(64);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.PayloadJson).HasColumnType("jsonb");
            e.Property(x => x.ReturnNote).HasMaxLength(4000);
            e.Property(x => x.SubmittedByUserId).HasMaxLength(450);
            e.Property(x => x.SubmittedByName).HasMaxLength(256);
            e.Property(x => x.AcceptedByUserId).HasMaxLength(450);
            e.Property(x => x.AcceptedByName).HasMaxLength(256);
            e.Property(x => x.ReopenedByUserId).HasMaxLength(450);
            e.Property(x => x.ReopenedByName).HasMaxLength(256);
            e.HasIndex(x => x.WorkflowTaskId).IsUnique();
            e.HasIndex(x => x.PoNumber);
        });

        builder.Entity<FieldInspectionWorkspace>(e =>
        {
            e.ToTable("FieldInspectionWorkspaces", DatabaseSchemas.CaseStudy);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.WorkflowTaskId);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.InspectionTime).HasMaxLength(16);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.MapLatitude).HasPrecision(10, 6);
            e.Property(x => x.MapLongitude).HasPrecision(10, 6);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.PropertyId);
            e.HasIndex(x => x.PartyTaskSubmissionId).IsUnique();
        });

        builder.Entity<InspectorFeeLedger>(e =>
        {
            e.ToTable("InspectorFeeLedgers", DatabaseSchemas.CaseStudy);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).HasMaxLength(128).IsRequired();
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.InspectorType).HasMaxLength(32);
            e.Property(x => x.SupervisingDepartment).HasMaxLength(32);
            e.Property(x => x.DiscountReason).HasMaxLength(2000);
            e.Property(x => x.BillingStatus).HasMaxLength(32);
            e.Property(x => x.PreSuspensionStatus).HasMaxLength(32);
            e.Property(x => x.SuspensionReason).HasMaxLength(2000);
            e.Property(x => x.ExclusionReason).HasMaxLength(2000);
            e.Property(x => x.ReturnTo).HasMaxLength(32);
            e.Property(x => x.DisbursementVoucher).HasMaxLength(128);
            e.Property(x => x.AgreedFeeSar).HasPrecision(12, 2);
            e.Property(x => x.SupervisorDiscountSar).HasPrecision(12, 2);
            e.Property(x => x.NetFeeSar).HasPrecision(12, 2);
            e.Property(x => x.PaidAmountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.WorkflowTaskId);
            e.HasIndex(x => new { x.TransactionId, x.DeedId, x.UserId })
                .IsUnique()
                .HasDatabaseName("UX_InspectorFeeLedgers_Transaction_Deed_User");
            e.HasIndex(x => x.AccruedAtUtc);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.SupervisingDepartment);
            e.HasIndex(x => x.BillingStatus);
            // Indexed to answer "what did this table price?" — the question a rate change raises.
            e.HasIndex(x => x.PricingTableId);
            e.HasIndex(x => x.ExcludedFromBatch);
            e.HasIndex(x => x.DisbursementBatchId);
            e.HasIndex(x => x.PartyBillingStatementId);
        });

        builder.Entity<DisbursementBatch>(e =>
        {
            e.ToTable("DisbursementBatches", DatabaseSchemas.CaseStudy);
            e.HasKey(x => x.Id);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.TotalNetSar).HasPrecision(14, 2);
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.CreatedAtUtc);
        });

        builder.Entity<PartyBillingStatement>(e =>
        {
            e.ToTable("PartyBillingStatements", DatabaseSchemas.Financial);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.ReferenceNumber).HasMaxLength(32);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.IssuedByUserId).HasMaxLength(450);
            e.Property(x => x.ClosedByUserId).HasMaxLength(450);
            e.Property(x => x.ExternalInvoiceNumber).HasMaxLength(128);
            e.Property(x => x.TransferReceiptRef).HasMaxLength(256);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.TotalNetSar).HasPrecision(14, 2);
            e.HasIndex(x => x.ReferenceNumber).IsUnique();
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasMany(x => x.Lines)
                .WithOne(x => x.Statement!)
                .HasForeignKey(x => x.StatementId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PartyBillingStatementLine>(e =>
        {
            e.ToTable("PartyBillingStatementLines", DatabaseSchemas.Financial);
            e.HasKey(x => x.Id);
            e.Property(x => x.NetFeeSar).HasPrecision(12, 2);
            e.HasIndex(x => x.StatementId);
            e.HasIndex(x => x.WorkflowTaskId).IsUnique();
        });

        builder.Entity<PoEnfazRevenueLine>(e =>
        {
            e.ToTable("PoEnfazRevenueLines", DatabaseSchemas.Financial);
            e.HasKey(x => x.Id);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.CaseStudyFeeSar).HasPrecision(12, 2);
            e.Property(x => x.SurveyFeeSar).HasPrecision(12, 2);
            e.Property(x => x.KeyFeeSar).HasPrecision(12, 2);
            e.Ignore(x => x.TotalFeeSar);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId }).IsUnique();
            e.HasIndex(x => x.KeyEntitlementEnvelopeId);
        });

        builder.Entity<PoEnfazInvoice>(e =>
        {
            e.ToTable("PoEnfazInvoices", DatabaseSchemas.Financial);
            e.HasKey(x => x.PoNumber);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.InvoiceNumber).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.SubtotalSar).HasPrecision(14, 2);
            e.Property(x => x.VatSar).HasPrecision(14, 2);
            e.Property(x => x.TotalSar).HasPrecision(14, 2);
            e.Property(x => x.CollectedAmountSar).HasPrecision(14, 2);
            e.Property(x => x.AttachmentIdsJson).HasColumnType("jsonb");
        });

        builder.Entity<InspectorFeeTransition>(e =>
        {
            e.ToTable("InspectorFeeTransitions", DatabaseSchemas.CaseStudy);
            e.HasKey(x => x.Id);
            e.Property(x => x.FromStatus).HasMaxLength(32);
            e.Property(x => x.ToStatus).HasMaxLength(32);
            e.Property(x => x.Reason).HasMaxLength(2000);
            e.Property(x => x.ActorUserId).HasMaxLength(450);
            e.HasIndex(x => x.WorkflowTaskId);
            e.HasIndex(x => x.CreatedAtUtc);
        });

        builder.Entity<CaseStudyForm>(e =>
        {
            e.ToTable("CaseStudyForms", DatabaseSchemas.CaseStudy);
            e.UseOptimisticConcurrency();
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.RequestNumber).HasMaxLength(128);
            e.Property(x => x.RequestDate).HasMaxLength(32);
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.AnswersJson).HasColumnType("jsonb");
            e.Property(x => x.AnswerProvenanceJson).HasColumnType("jsonb");
            e.Property(x => x.DeedRemarks).HasMaxLength(4000);
            e.Property(x => x.SurveyRemarks).HasMaxLength(4000);
            e.Property(x => x.ComponentsRemarks).HasMaxLength(4000);
            e.Property(x => x.OccupancyRemarks).HasMaxLength(4000);
            e.Property(x => x.MeterType).HasMaxLength(32);
            e.Property(x => x.MeterNumber).HasMaxLength(128);
            e.Property(x => x.HoaFee).HasMaxLength(64);
            e.Property(x => x.SigDeed).HasMaxLength(256);
            e.Property(x => x.SigApprover).HasMaxLength(256);
            e.Property(x => x.SigDate).HasMaxLength(32);
            e.Property(x => x.SpecialistReviewApprovedJson).HasColumnType("jsonb");
            e.Property(x => x.InfathLinkedAssets).HasMaxLength(8);
            e.Property(x => x.InfathLinkedDeedNumbers).HasMaxLength(512);
            e.Property(x => x.InfathLinkedAssetsNotes).HasMaxLength(4000);
            e.Property(x => x.InfathOtherNotes).HasMaxLength(4000);
            e.Property(x => x.InfathClosingNotes).HasMaxLength(4000);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.HasIndex(x => new { x.TaskId, x.IsPartyForm }).IsUnique();
        });

        builder.Entity<KeyReceiptFeeCharge>(e =>
        {
            e.ToTable("KeyReceiptFeeCharges", DatabaseSchemas.Financial);
            e.UseOptimisticConcurrency();
            e.Property(x => x.RequestNumber).HasMaxLength(128);
            e.Property(x => x.AmountSar).HasPrecision(12, 2);
            e.Property(x => x.CollectionStatus).HasMaxLength(32);
            e.Property(x => x.InvoiceReference).HasMaxLength(128);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.CreatedByName).HasMaxLength(256);
            e.HasIndex(x => x.EnvelopeId).IsUnique();
            e.HasIndex(x => x.RequestNumber);
            e.HasIndex(x => x.CollectionStatus);
        });

        builder.Entity<CourtVisitFeeCharge>(e =>
        {
            e.ToTable("CourtVisitFeeCharges", DatabaseSchemas.Financial);
            e.UseOptimisticConcurrency();
            e.Property(x => x.TaskDisplayId).HasMaxLength(32);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.CreditAssigneeId).HasMaxLength(128);
            e.Property(x => x.CreditAssigneeName).HasMaxLength(256);
            e.Property(x => x.AmountSar).HasPrecision(12, 2);
            e.Property(x => x.Status).HasMaxLength(32);
            e.HasIndex(x => x.OperationsTaskId).IsUnique();
            e.HasIndex(x => x.CreditAssigneeId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.PricingTableId);
        });

        builder.Entity<InternalDelegationLetterSet>(e =>
        {
            e.ToTable("InternalDelegationLetterSets", DatabaseSchemas.CaseStudy);
            e.Property(x => x.ScopeKey).HasMaxLength(128);
            e.Property(x => x.LettersJson).HasColumnType("jsonb");
            e.HasIndex(x => x.ScopeKey).IsUnique();
        });

        builder.Entity<DocumentReferenceCounter>(e =>
        {
            e.ToTable("DocumentReferenceCounters", DatabaseSchemas.CaseStudy);
            e.Property(x => x.Dept).HasMaxLength(8);
            e.Property(x => x.Type).HasMaxLength(8);
            e.Property(x => x.DateKey).HasMaxLength(8);
            e.HasIndex(x => new { x.Dept, x.Type, x.DateKey }).IsUnique();
        });

        builder.Entity<PoIntakeDraft>(e =>
        {
            e.ToTable("PoIntakeDrafts", DatabaseSchemas.CaseStudy);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.Property(x => x.DraftJson).HasColumnType("jsonb");
            e.HasIndex(x => x.UserId).IsUnique();
        });

        builder.Entity<FinancialReportConfig>(e =>
        {
            e.ToTable("FinancialReportConfigs", DatabaseSchemas.Financial);
            e.Property(x => x.ReportJson).HasColumnType("jsonb");
        });

        builder.Entity<PartyFeePricingTable>(e =>
        {
            e.ToTable("PartyFeePricingTables", DatabaseSchemas.Financial);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(128).IsRequired();
            e.Property(x => x.Category).HasMaxLength(32).IsRequired();
            e.Property(x => x.PricingKind).HasMaxLength(32).IsRequired();
            e.Property(x => x.ManagedBy).HasMaxLength(32).IsRequired();
            e.Property(x => x.GovernmentReviewFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorIndividualFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorOrganizationFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FlatAmountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.Category).IsUnique().HasFilter("\"IsActive\" = true");
            e.HasIndex(x => x.PricingKind);
            e.HasMany(x => x.AreaTiers).WithOne(x => x.Table).HasForeignKey(x => x.TableId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Assignments).WithOne(x => x.Table).HasForeignKey(x => x.TableId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<IncentiveSuspension>(e =>
        {
            e.ToTable("IncentiveSuspensions", DatabaseSchemas.Financial);
            e.HasKey(x => x.Id);
            e.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.AssigneeId).HasMaxLength(128).IsRequired();
            e.Property(x => x.TransactionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.Property(x => x.CreatedByUserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.LiftedByUserId).HasMaxLength(450);
            e.HasIndex(x => new { x.AssigneeId, x.TransactionKey });
            e.HasIndex(x => new { x.AssigneeId, x.TransactionKey }).IsUnique().HasFilter("\"LiftedAtUtc\" IS NULL").HasDatabaseName("IX_IncentiveSuspensions_ActiveAssigneeTransaction");
        });

        builder.Entity<DiscountFlag>(e =>
        {
            e.ToTable("DiscountFlags", DatabaseSchemas.Financial);
            e.HasKey(x => x.Id);
            e.Property(x => x.TransactionKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.TargetAssigneeId).HasMaxLength(128).IsRequired();
            e.Property(x => x.FlaggedByUserId).HasMaxLength(450).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(2000).IsRequired();
            e.Property(x => x.Status).HasMaxLength(32).IsRequired();
            e.Property(x => x.ApprovedByUserId).HasMaxLength(450);
            e.Property(x => x.ResolutionNote).HasMaxLength(2000);
            e.Property(x => x.ProposedDiscountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.TransactionKey);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => new { x.TransactionKey, x.TargetAssigneeId, x.Status });
        });

        builder.Entity<PartyFeePricingTier>(e =>
        {
            e.ToTable("PartyFeePricingTiers", DatabaseSchemas.Financial);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.MaxAreaM2).HasPrecision(12, 2);
            e.Property(x => x.FeeSar).HasPrecision(12, 2);
            e.HasIndex(x => new { x.TableId, x.SortOrder });
        });

        builder.Entity<PartyFeePricingAssignment>(e =>
        {
            e.ToTable("PartyFeePricingAssignments", DatabaseSchemas.Financial);
            e.UseOptimisticConcurrency();
            e.HasKey(x => x.Id);
            e.Property(x => x.Category).HasMaxLength(32).IsRequired();
            e.Property(x => x.AssigneeId).HasMaxLength(128).IsRequired();
            e.HasIndex(x => new { x.Category, x.AssigneeId }).IsUnique();
            e.HasIndex(x => x.TableId);
        });

        builder.Entity<PropertyTimelineEntry>(e =>
        {
            e.ToTable("PropertyTimelineEntries", DatabaseSchemas.CaseStudy);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.EventKey).HasMaxLength(128);
            e.Property(x => x.Title).HasMaxLength(256);
            e.Property(x => x.Detail).HasMaxLength(2000);
            e.Property(x => x.Tone).HasMaxLength(16);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId, x.EventKey }).IsUnique();
            e.HasIndex(x => new { x.PoNumber, x.PropertyId, x.OccurredAtUtc });
        });

        builder.Entity<UserNotification>(e =>
        {
            e.ToTable("UserNotifications", DatabaseSchemas.Messaging);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.Property(x => x.Title).HasMaxLength(256);
            e.Property(x => x.Body).HasMaxLength(2000);
            e.Property(x => x.Href).HasMaxLength(512);
            e.Property(x => x.Tone).HasMaxLength(16);
            e.Property(x => x.Category).HasMaxLength(32);
            e.Property(x => x.EntityType).HasMaxLength(32);
            e.Property(x => x.EntityId).HasMaxLength(128);
            e.Property(x => x.Actor).HasMaxLength(256);
            e.Property(x => x.SourceEvent).HasMaxLength(256);
            e.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            e.HasIndex(x => new { x.UserId, x.ReadAtUtc });
            // Dedupe rule: a user never holds two unread notifications for the same source
            // event. Enforced here so concurrent deliveries of one event collide in the
            // database instead of both passing a check-then-insert probe.
            e.HasIndex(x => new { x.UserId, x.SourceEvent })
                .IsUnique()
                .HasFilter("\"SourceEvent\" IS NOT NULL AND \"ReadAtUtc\" IS NULL")
                .HasDatabaseName(DatabaseIndexNames.UserNotificationUnreadSourceEvent);
        });

        builder.Entity<PushSubscription>(e =>
        {
            e.ToTable("PushSubscriptions", DatabaseSchemas.Messaging);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.Property(x => x.Endpoint).HasMaxLength(1024);
            e.Property(x => x.P256dh).HasMaxLength(256);
            e.Property(x => x.Auth).HasMaxLength(64);
            e.Property(x => x.UserAgent).HasMaxLength(512);
            e.Property(x => x.DeviceLabel).HasMaxLength(128);
            e.Property(x => x.DisabledReason).HasMaxLength(128);
            e.HasIndex(x => x.Endpoint)
                .IsUnique()
                .HasDatabaseName(DatabaseIndexNames.PushSubscriptionEndpoint);
            e.HasIndex(x => new { x.UserId, x.DisabledAtUtc });
        });

        builder.Entity<PushPreference>(e =>
        {
            e.ToTable("PushPreferences", DatabaseSchemas.Messaging);
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasMaxLength(450);
        });
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
