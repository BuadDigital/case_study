using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

/// <summary>
/// Case Study–owned tables in the <c>case_study</c> schema. Does not map operations tasks (D2)
/// or inspector-fee tables (D1) — those write paths belong to Operations / Financial while the
/// rows remain physically here. Applied by <see cref="CaseStudyDbContext"/> and by the legacy
/// context (transitional cross-boundary reads until owner APIs replace them).
/// </summary>
// A8: public — the owner context lives in its context library; this shared mapping stays
// global beside the frozen legacy context (drift guard).
public static class CaseStudyModel
{
    public static ModelBuilder ApplyCaseStudyModel(this ModelBuilder builder, bool ownsMigrations = true)
    {
        builder.Entity<WorkOrder>(e =>
        {
            MapTable(e, "WorkOrders", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.HasIndex(x => x.PoNumber).IsUnique();
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.AssignmentSpecialist).HasMaxLength(256).IsRequired(false);
            e.Property(x => x.AssignmentSpecialistEmail).HasMaxLength(256).IsRequired(false);
            e.Property(x => x.ReceivedFromEnfathTime).HasMaxLength(8);
            e.Property(x => x.LifecycleStatus).HasMaxLength(32).IsRequired(false);
            e.Property(x => x.PropertiesRegion).HasMaxLength(256).IsRequired(false);
            e.Property(x => x.WorkOrderDescription).HasMaxLength(2000).IsRequired(false);
            e.Property(x => x.ReportUserClientIdsJson).HasColumnType("jsonb");
            e.HasOne(x => x.Client)
                .WithMany()
                .HasForeignKey(x => x.ClientId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Properties)
                .WithOne(x => x.WorkOrder)
                .HasForeignKey(x => x.WorkOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasIndex(x => x.ClientId);
        });

        builder.Entity<Client>(e =>
        {
            MapTable(e, "Clients", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.NameAr).HasMaxLength(256).IsRequired();
            e.Property(x => x.NameEn).HasMaxLength(256);
            e.Property(x => x.IdentityNumber).HasMaxLength(64);
            e.Property(x => x.Phone).HasMaxLength(32);
            e.Property(x => x.Email).HasMaxLength(256);
            e.HasIndex(x => x.IsActive);
            e.HasIndex(x => x.NameAr);
        });

        builder.Entity<WorkOrderProperty>(e =>
        {
            MapTable(e, "WorkOrderProperties", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.DeedKind)
                .HasConversion<int>();
            e.Property(x => x.HasStructuresToValue).HasMaxLength(8);
            e.Property(x => x.InspectionScopeKey).HasMaxLength(16);
            e.Property(x => x.InspectionRestrictionReason).HasMaxLength(2000);
            // ق-9: رفع إنفاذ الشامل.
            e.Property(x => x.EnfazHandoverByUserId).HasMaxLength(128);
            e.Property(x => x.RemoteInspectionApprovedBy).HasMaxLength(128);
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
            e.Property(x => x.NorthBoundaryType).HasMaxLength(32);
            e.Property(x => x.NorthFacadeFinishing).HasMaxLength(128);
            e.Property(x => x.SouthBoundary).HasMaxLength(512);
            e.Property(x => x.SouthBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.SouthBoundaryType).HasMaxLength(32);
            e.Property(x => x.SouthFacadeFinishing).HasMaxLength(128);
            e.Property(x => x.EastBoundary).HasMaxLength(512);
            e.Property(x => x.EastBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.EastBoundaryType).HasMaxLength(32);
            e.Property(x => x.EastFacadeFinishing).HasMaxLength(128);
            e.Property(x => x.WestBoundary).HasMaxLength(512);
            e.Property(x => x.WestBoundaryLengthM).HasMaxLength(32);
            e.Property(x => x.WestBoundaryType).HasMaxLength(32);
            e.Property(x => x.WestFacadeFinishing).HasMaxLength(128);
            e.Property(x => x.RestrictionsPresent).HasMaxLength(8);
            e.Property(x => x.RestrictionType).HasMaxLength(128);
            e.Property(x => x.RestrictionOtherReason).HasMaxLength(500);
            e.Property(x => x.DeedOwnersJson).HasMaxLength(4000);
            e.Property(x => x.OwnershipType).HasMaxLength(32);
            e.Property(x => x.PlanNumber).HasMaxLength(128);
            e.Property(x => x.PlanName).HasMaxLength(256);
            e.Property(x => x.PlotNumber).HasMaxLength(128);
            e.Property(x => x.BlockNumber).HasMaxLength(64);
            e.Property(x => x.LocationMapUrl).HasMaxLength(1024);
            e.Property(x => x.PartitionMinutesNumber).HasMaxLength(128);
            e.Property(x => x.PartitionMinutesDate).HasMaxLength(32);
            e.Property(x => x.FinishingType).HasMaxLength(32);
            e.Property(x => x.FinishingStructure).HasMaxLength(32);
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
            e.HasMany(x => x.BuildingInventoryLines)
                .WithOne(x => x.Property)
                .HasForeignKey(x => x.PropertyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<BuildingInventoryLine>(e =>
        {
            MapTable(e, "BuildingInventoryLines", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.StructureKind).HasMaxLength(32).IsRequired();
            e.Property(x => x.Label).HasMaxLength(256).IsRequired();
            e.Property(x => x.AreaSqm).HasMaxLength(32);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.HasIndex(x => x.PropertyId);
            e.HasIndex(x => new { x.PropertyId, x.SortOrder });
        });

        builder.Entity<PropertyGroup>(e =>
        {
            MapTable(e, "PropertyGroups", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.Name).HasMaxLength(256);
            e.HasMany(x => x.Members)
                .WithOne(x => x.Group!)
                .HasForeignKey(x => x.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PropertyGroupMember>(e =>
        {
            MapTable(e, "PropertyGroupMembers", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.LinkedByUserId).HasMaxLength(128).IsRequired();
            e.Property(x => x.SuggestionSignals).HasMaxLength(512);
            e.Property(x => x.UnlinkReason).HasMaxLength(2000);
            e.Property(x => x.UnlinkedByUserId).HasMaxLength(128);
            e.HasIndex(x => x.GroupId);
            e.HasIndex(x => new { x.PropertyId, x.IsActive });
        });

        builder.Entity<PropertyContact>(e =>
        {
            MapTable(e, "PropertyContacts", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.Role).HasMaxLength(128);
            e.Property(x => x.Phone).HasMaxLength(32);
        });

        builder.Entity<WorkflowTask>(e =>
        {
            MapTable(e, "WorkflowTasks", DatabaseSchemas.CaseStudy, ownsMigrations);
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
            e.HasIndex(x => x.AssigneeId);
        });

        builder.Entity<PartyTaskSubmission>(e =>
        {
            MapTable(e, "PartyTaskSubmissions", DatabaseSchemas.CaseStudy, ownsMigrations);
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
            MapTable(e, "FieldInspectionWorkspaces", DatabaseSchemas.CaseStudy, ownsMigrations);
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

        builder.Entity<CaseStudyForm>(e =>
        {
            MapTable(e, "CaseStudyForms", DatabaseSchemas.CaseStudy, ownsMigrations);
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
            e.Property(x => x.DeedNatureMatchOutcome).HasMaxLength(32);
            e.Property(x => x.DeedNatureMatchNotes).HasMaxLength(4000);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.HasIndex(x => new { x.TaskId, x.IsPartyForm }).IsUnique();
        });

        builder.Entity<InternalDelegationLetterSet>(e =>
        {
            MapTable(e, "InternalDelegationLetterSets", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.ScopeKey).HasMaxLength(128);
            e.Property(x => x.LettersJson).HasColumnType("jsonb");
            e.HasIndex(x => x.ScopeKey).IsUnique();
        });

        builder.Entity<DocumentReferenceCounter>(e =>
        {
            MapTable(e, "DocumentReferenceCounters", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.Dept).HasMaxLength(8);
            e.Property(x => x.Type).HasMaxLength(8);
            e.Property(x => x.DateKey).HasMaxLength(8);
            e.HasIndex(x => new { x.Dept, x.Type, x.DateKey }).IsUnique();
        });

        builder.Entity<PoIntakeDraft>(e =>
        {
            MapTable(e, "PoIntakeDrafts", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.Property(x => x.DraftJson).HasColumnType("jsonb");
            e.HasIndex(x => x.UserId).IsUnique();
        });

        builder.Entity<PropertyTimelineEntry>(e =>
        {
            MapTable(e, "PropertyTimelineEntries", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.EventKey).HasMaxLength(128);
            e.Property(x => x.Title).HasMaxLength(256);
            e.Property(x => x.Detail).HasMaxLength(2000);
            e.Property(x => x.Tone).HasMaxLength(16);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId, x.EventKey }).IsUnique();
            e.HasIndex(x => new { x.PoNumber, x.PropertyId, x.OccurredAtUtc });
        });

        return builder;
    }

    private static void MapTable<TEntity>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> e,
        string table,
        string schema,
        bool ownsMigrations)
        where TEntity : class
    {
        if (ownsMigrations)
            e.ToTable(table, schema);
        else
            e.ToTable(table, schema, t => t.ExcludeFromMigrations());
    }
}
