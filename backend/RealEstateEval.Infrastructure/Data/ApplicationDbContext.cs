using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
namespace RealEstateEval.Infrastructure.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options): base(options) {}
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<HrEmployeeProfile> HrEmployeeProfiles => Set<HrEmployeeProfile>();
    public DbSet<ProcServiceProviderProfile> ProcServiceProviderProfiles => Set<ProcServiceProviderProfile>();
    public DbSet<CrmClientProfile> CrmClientProfiles => Set<CrmClientProfile>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderProperty> WorkOrderProperties => Set<WorkOrderProperty>();
    public DbSet<PropertyContact> PropertyContacts => Set<PropertyContact>();
    public DbSet<CourtCatalogEntry> CourtCatalogEntries => Set<CourtCatalogEntry>();
    public DbSet<Court> Courts => Set<Court>();
    public DbSet<CourtCircuit> CourtCircuits => Set<CourtCircuit>();
    public DbSet<WorkflowTask> WorkflowTasks => Set<WorkflowTask>();
    public DbSet<CaseStudyForm> CaseStudyForms => Set<CaseStudyForm>();
    public DbSet<CaseStudyInfoRolesConfig> CaseStudyInfoRolesConfigs => Set<CaseStudyInfoRolesConfig>();
    public DbSet<PartyTaskSubmission> PartyTaskSubmissions => Set<PartyTaskSubmission>();
    public DbSet<FieldInspectionWorkspace> FieldInspectionWorkspaces => Set<FieldInspectionWorkspace>();
    public DbSet<InspectorFeeLedger> InspectorFeeLedgers => Set<InspectorFeeLedger>();
    public DbSet<InspectorFeeTransition> InspectorFeeTransitions => Set<InspectorFeeTransition>();
    public DbSet<DisbursementBatch> DisbursementBatches => Set<DisbursementBatch>();
    public DbSet<PoEnfazRevenueLine> PoEnfazRevenueLines => Set<PoEnfazRevenueLine>();
    public DbSet<PoEnfazInvoice> PoEnfazInvoices => Set<PoEnfazInvoice>();
    public DbSet<PropertyFailure> PropertyFailures => Set<PropertyFailure>();
    public DbSet<PropertyTimelineEntry> PropertyTimelineEntries => Set<PropertyTimelineEntry>();
    public DbSet<FieldDictionaryConfig> FieldDictionaryConfigs => Set<FieldDictionaryConfig>();
    public DbSet<FailureTypesCatalogConfig> FailureTypesCatalogConfigs => Set<FailureTypesCatalogConfig>();
    public DbSet<SurveyOffice> SurveyOffices => Set<SurveyOffice>();
    public DbSet<ValuationRequest> ValuationRequests => Set<ValuationRequest>();
    public DbSet<PropertyKeyRecord> PropertyKeyRecords => Set<PropertyKeyRecord>();
    public DbSet<FileAttachment> FileAttachments => Set<FileAttachment>();
    public DbSet<InternalDelegationLetterSet> InternalDelegationLetterSets => Set<InternalDelegationLetterSet>();
    public DbSet<EvaluatorRecallRecord> EvaluatorRecallRecords => Set<EvaluatorRecallRecord>();
    public DbSet<PoIntakeDraft> PoIntakeDrafts => Set<PoIntakeDraft>();
    public DbSet<FinancialReportConfig> FinancialReportConfigs => Set<FinancialReportConfig>();
    public DbSet<PartyFeePricingConfig> PartyFeePricingConfigs => Set<PartyFeePricingConfig>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(e => e.ToTable("Users", DatabaseSchemas.Identity));
        builder.Entity<IdentityRole>(e => e.ToTable("Roles", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserRole<string>>(e => e.ToTable("UserRoles", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserClaim<string>>(e => e.ToTable("UserClaims", DatabaseSchemas.Identity));
        builder.Entity<IdentityRoleClaim<string>>(e => e.ToTable("RoleClaims", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserLogin<string>>(e => e.ToTable("UserLogins", DatabaseSchemas.Identity));
        builder.Entity<IdentityUserToken<string>>(e => e.ToTable("UserTokens", DatabaseSchemas.Identity));

        builder.Entity<UserProfile>(e =>
        {
            e.ToTable("UserProfiles", DatabaseSchemas.Identity);
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.User)
                .WithOne()
                .HasForeignKey<UserProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.JobTitle).HasMaxLength(256);
            e.Property(x => x.DistributionAssigneeId).HasMaxLength(128);
            e.Property(x => x.ReviewerCityCoverageJson).HasMaxLength(1024);
            e.Property(x => x.PermissionLevel).HasMaxLength(64);
            e.HasIndex(x => x.DistributionAssigneeId);
        });

        builder.Entity<HrEmployeeProfile>(e =>
        {
            e.ToTable("HrEmployeeProfiles", DatabaseSchemas.Identity);
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.Profile)
                .WithOne(x => x.HrEmployee)
                .HasForeignKey<HrEmployeeProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.EmploymentType).HasMaxLength(64);
            e.Property(x => x.Department).HasMaxLength(256);
            e.Property(x => x.Section).HasMaxLength(256);
        });

        builder.Entity<ProcServiceProviderProfile>(e =>
        {
            e.ToTable("ProcServiceProviderProfiles", DatabaseSchemas.Identity);
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.Profile)
                .WithOne(x => x.ProcProvider)
                .HasForeignKey<ProcServiceProviderProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.ServiceType).HasMaxLength(128);
        });

        builder.Entity<CrmClientProfile>(e =>
        {
            e.ToTable("CrmClientProfiles", DatabaseSchemas.Identity);
            e.HasKey(x => x.UserId);
            e.HasOne(x => x.Profile)
                .WithOne(x => x.CrmClient)
                .HasForeignKey<CrmClientProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkOrder>(e =>
        {
            e.ToTable("WorkOrders", DatabaseSchemas.CaseStudy);
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
            e.Property(x => x.RestrictionType).HasMaxLength(32);
            e.Property(x => x.RestrictionOtherReason).HasMaxLength(500);
            e.Property(x => x.PlanNumber).HasMaxLength(128);
            e.Property(x => x.PlotNumber).HasMaxLength(128);
            e.Property(x => x.LocationMapUrl).HasMaxLength(1024);
            e.Property(x => x.RemovalReason).HasMaxLength(500);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.District).HasMaxLength(128);
            e.Property(x => x.Classification).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.HasIndex(x => x.CourtId);
            e.HasIndex(x => x.CircuitId);
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

        builder.Entity<CourtCatalogEntry>(e =>
        {
            e.ToTable("CourtCatalogEntries", DatabaseSchemas.Platform);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.Court).HasMaxLength(256);
            e.Property(x => x.CircuitsJson).HasColumnType("jsonb");
        });

        builder.Entity<Court>(e =>
        {
            e.ToTable("Courts", DatabaseSchemas.Platform);
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Region).HasMaxLength(80).IsRequired();
            e.Property(x => x.City).HasMaxLength(80).IsRequired();
            e.Property(x => x.CreatedBy).HasMaxLength(128).IsRequired();
            e.Property(x => x.UpdatedBy).HasMaxLength(128);
            e.HasIndex(x => new { x.Name, x.City }).IsUnique();
            e.HasIndex(x => new { x.Region, x.City });
            e.HasIndex(x => x.IsActive);
            e.HasMany(x => x.Circuits)
                .WithOne(x => x.Court)
                .HasForeignKey(x => x.CourtId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<CourtCircuit>(e =>
        {
            e.ToTable("CourtCircuits", DatabaseSchemas.Platform);
            e.Property(x => x.CircuitNo).HasMaxLength(50).IsRequired();
            e.Property(x => x.CircuitName).HasMaxLength(150);
            e.Property(x => x.CreatedBy).HasMaxLength(128).IsRequired();
            e.Property(x => x.UpdatedBy).HasMaxLength(128);
            e.HasIndex(x => new { x.CourtId, x.CircuitNo }).IsUnique();
            e.HasIndex(x => x.IsActive);
        });

        builder.Entity<WorkflowTask>(e =>
        {
            e.ToTable("WorkflowTasks", DatabaseSchemas.CaseStudy);
            e.Property(x => x.Kind).HasMaxLength(64);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.Title).HasMaxLength(512);
            e.Property(x => x.Phase).HasMaxLength(32);
            e.Property(x => x.AssigneeRole).HasMaxLength(64);
            e.Property(x => x.AssigneeName).HasMaxLength(256);
            e.Property(x => x.AssigneeId).HasMaxLength(64);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.DistributionJson).HasColumnType("jsonb");
            e.Property(x => x.ObstructionReason).HasMaxLength(2000);
            e.Property(x => x.ObstructionPriorPhase).HasMaxLength(32);
            e.Property(x => x.AssignmentType).HasMaxLength(64);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => new { x.PoNumber, x.PropertyOrdinal });
            e.HasIndex(x => new { x.PoNumber, x.PropertyId });
            e.HasIndex(x => x.PropertyId);
            e.HasIndex(x => x.ParentTaskId);
            e.HasIndex(x => new { x.Kind, x.Status });
            e.HasIndex(x => x.CreatedAtUtc);
        });

        builder.Entity<CaseStudyInfoRolesConfig>(e =>
        {
            e.ToTable("CaseStudyInfoRolesConfigs", DatabaseSchemas.Platform);
            e.Property(x => x.MatrixJson).HasColumnType("jsonb");
            e.Property(x => x.NotesJson).HasColumnType("jsonb");
        });

        builder.Entity<PartyTaskSubmission>(e =>
        {
            e.ToTable("PartyTaskSubmissions", DatabaseSchemas.CaseStudy);
            e.Property(x => x.Kind).HasMaxLength(64);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.PayloadJson).HasColumnType("jsonb");
            e.Property(x => x.ReturnNote).HasMaxLength(4000);
            e.HasIndex(x => x.WorkflowTaskId).IsUnique();
            e.HasIndex(x => x.PoNumber);
        });

        builder.Entity<FieldInspectionWorkspace>(e =>
        {
            e.ToTable("FieldInspectionWorkspaces", DatabaseSchemas.CaseStudy);
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
            e.HasKey(x => x.WorkflowTaskId);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.InspectorType).HasMaxLength(32);
            e.Property(x => x.DiscountReason).HasMaxLength(2000);
            e.Property(x => x.BillingStatus).HasMaxLength(32);
            e.Property(x => x.ExclusionReason).HasMaxLength(2000);
            e.Property(x => x.ReturnTo).HasMaxLength(32);
            e.Property(x => x.DisbursementVoucher).HasMaxLength(128);
            e.Property(x => x.AgreedFeeSar).HasPrecision(12, 2);
            e.Property(x => x.SupervisorDiscountSar).HasPrecision(12, 2);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.BillingStatus);
            e.HasIndex(x => x.ExcludedFromBatch);
            e.HasIndex(x => x.DisbursementBatchId);
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

        builder.Entity<PoEnfazRevenueLine>(e =>
        {
            e.ToTable("PoEnfazRevenueLines", DatabaseSchemas.Financial);
            e.HasKey(x => x.Id);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.CaseStudyFeeSar).HasPrecision(12, 2);
            e.Property(x => x.SurveyFeeSar).HasPrecision(12, 2);
            e.Ignore(x => x.TotalFeeSar);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId }).IsUnique();
        });

        builder.Entity<PoEnfazInvoice>(e =>
        {
            e.ToTable("PoEnfazInvoices", DatabaseSchemas.Financial);
            e.HasKey(x => x.PoNumber);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.InvoiceNumber).HasMaxLength(128);
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

        builder.Entity<PropertyFailure>(e =>
        {
            e.ToTable("PropertyFailures", DatabaseSchemas.Failures);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.Title).HasMaxLength(512);
            e.Property(x => x.ProblemTypeId).HasMaxLength(64);
            e.Property(x => x.Severity).HasMaxLength(32);
            e.Property(x => x.RaisedByRole).HasMaxLength(128);
            e.Property(x => x.InternalNote).HasMaxLength(4000);
            e.Property(x => x.FinalNote).HasMaxLength(4000);
            e.Property(x => x.ResolutionReason).HasMaxLength(4000);
            e.Property(x => x.ContinueInstructions).HasMaxLength(4000);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.Specialist).HasMaxLength(256);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId });
            e.HasIndex(x => x.Status);
        });

        builder.Entity<CaseStudyForm>(e =>
        {
            e.ToTable("CaseStudyForms", DatabaseSchemas.CaseStudy);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.RequestNumber).HasMaxLength(128);
            e.Property(x => x.RequestDate).HasMaxLength(32);
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.AnswersJson).HasColumnType("jsonb");
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

        builder.Entity<FieldDictionaryConfig>(e =>
        {
            e.ToTable("FieldDictionaryConfigs", DatabaseSchemas.Platform);
            e.Property(x => x.StateJson).HasColumnType("jsonb");
        });

        builder.Entity<FailureTypesCatalogConfig>(e =>
        {
            e.ToTable("FailureTypesCatalogConfigs", DatabaseSchemas.Failures);
            e.Property(x => x.CatalogJson).HasColumnType("jsonb");
        });

        builder.Entity<SurveyOffice>(e =>
        {
            e.ToTable("SurveyOffices", DatabaseSchemas.Operations);
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.AvgDaysLabel).HasMaxLength(64);
            e.Property(x => x.ContractLabel).HasMaxLength(128);
            e.HasIndex(x => x.SortOrder);
        });

        builder.Entity<ValuationRequest>(e =>
        {
            e.ToTable("ValuationRequests", DatabaseSchemas.Valuation);
            e.Property(x => x.DisplayId).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.Area).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.Property(x => x.Appraiser).HasMaxLength(256);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.RequestDate).HasMaxLength(32);
            e.HasIndex(x => x.DisplayId);
        });

        builder.Entity<PropertyKeyRecord>(e =>
        {
            e.ToTable("PropertyKeyRecords", DatabaseSchemas.Operations);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.Area).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.Property(x => x.Specialist).HasMaxLength(256);
            e.Property(x => x.WorkflowStatus).HasMaxLength(32);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId }).IsUnique();
        });

        builder.Entity<FileAttachment>(e =>
        {
            e.ToTable("FileAttachments", DatabaseSchemas.Attachments);
            e.Property(x => x.Scope).HasMaxLength(64);
            e.Property(x => x.ScopeKey).HasMaxLength(512);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.ContentType).HasMaxLength(128);
            e.Property(x => x.StorageKey).HasMaxLength(1024);
            e.Property(x => x.UploadedByUserId).HasMaxLength(450);
            e.HasIndex(x => new { x.Scope, x.ScopeKey });
        });

        builder.Entity<InternalDelegationLetterSet>(e =>
        {
            e.ToTable("InternalDelegationLetterSets", DatabaseSchemas.CaseStudy);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.LettersJson).HasColumnType("jsonb");
            e.HasIndex(x => x.PoNumber).IsUnique();
        });

        builder.Entity<EvaluatorRecallRecord>(e =>
        {
            e.ToTable("EvaluatorRecallRecords", DatabaseSchemas.Valuation);
            e.Property(x => x.TaskId).HasMaxLength(64);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.Reason).HasMaxLength(4000);
            e.Property(x => x.SpecialistNote).HasMaxLength(4000);
            e.HasIndex(x => x.TaskId).IsUnique();
            e.HasIndex(x => x.Status);
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

        builder.Entity<PartyFeePricingConfig>(e =>
        {
            e.ToTable("PartyFeePricingConfigs", DatabaseSchemas.Financial);
            e.HasKey(x => x.Id);
            e.Property(x => x.EngineeringSurveyFeeSar).HasPrecision(12, 2);
            e.Property(x => x.GovernmentReviewFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorIndividualFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorOrganizationFeeSar).HasPrecision(12, 2);
            e.Property(x => x.FieldInspectorEmployeeFeeSar).HasPrecision(12, 2);
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

        builder.Entity<OutboxMessage>(e =>
        {
            e.ToTable("OutboxMessages", DatabaseSchemas.Messaging);
            e.Property(x => x.EventType).HasMaxLength(128);
            e.Property(x => x.PayloadJson).HasColumnType("jsonb");
            e.Property(x => x.Error).HasMaxLength(2000);
            e.HasIndex(x => x.ProcessedAtUtc);
            e.HasIndex(x => x.CreatedAtUtc);
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
            e.HasIndex(x => new { x.UserId, x.SourceEvent });
        });
    }
}