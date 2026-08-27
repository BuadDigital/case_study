using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts;

/// <summary>
/// Operations-owned tables: the <c>operations</c> schema plus task rows that still live in
/// <c>case_study</c> physically (D2). Applied by <see cref="OperationsDbContext"/> (write path)
/// and by the legacy context for transitional cross-boundary reads until owner APIs replace them.
/// </summary>
// A8: public — the owner context lives in its context library; this shared mapping stays
// global beside the frozen legacy context (drift guard).
public static class OperationsModel
{
    public static ModelBuilder ApplyOperationsModel(this ModelBuilder builder, bool ownsMigrations = true)
    {
        builder.Entity<SurveyOffice>(e =>
        {
            MapTable(e, "SurveyOffices", DatabaseSchemas.Operations, ownsMigrations);
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.AvgDaysLabel).HasMaxLength(64);
            e.Property(x => x.ContractLabel).HasMaxLength(128);
            e.HasIndex(x => x.SortOrder);
        });

        builder.Entity<PropertyKeyRecord>(e =>
        {
            MapTable(e, "PropertyKeyRecords", DatabaseSchemas.Operations, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.Area).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.Property(x => x.Specialist).HasMaxLength(256);
            e.Property(x => x.WorkflowStatus).HasMaxLength(32);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId }).IsUnique();
        });

        builder.Entity<KeyEnvelope>(e =>
        {
            MapTable(e, "KeyEnvelopes", DatabaseSchemas.Operations, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.RequestNumber).HasMaxLength(128);
            e.Property(x => x.Court).HasMaxLength(256);
            e.Property(x => x.Circuit).HasMaxLength(150);
            e.Property(x => x.ContactPhones).HasMaxLength(1000);
            e.Property(x => x.Notes).HasMaxLength(4000);
            e.Property(x => x.ReceiveScenario).HasMaxLength(32);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.FeeAmountSar).HasPrecision(12, 2);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.CreatedByName).HasMaxLength(256);
            e.HasIndex(x => x.RequestNumber);
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.FeeGenerated);
            e.HasIndex(x => x.RevenueEntitlementAtUtc);
            e.HasIndex(x => x.OperationsTaskId);
            e.HasMany(x => x.Assignments)
                .WithOne(x => x.Envelope!)
                .HasForeignKey(x => x.EnvelopeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Handoffs)
                .WithOne(x => x.Envelope!)
                .HasForeignKey(x => x.EnvelopeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Timeline)
                .WithOne(x => x.Envelope!)
                .HasForeignKey(x => x.EnvelopeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<KeyEnvelopeAssignment>(e =>
        {
            MapTable(e, "KeyEnvelopeAssignments", DatabaseSchemas.Operations, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.ConfirmedByUserId).HasMaxLength(450);
            e.Property(x => x.ConfirmedByName).HasMaxLength(256);
            e.HasIndex(x => x.EnvelopeId);
            e.HasIndex(x => new { x.EnvelopeId, x.DeedNumber });
        });

        builder.Entity<KeyEnvelopeHandoff>(e =>
        {
            MapTable(e, "KeyEnvelopeHandoffs", DatabaseSchemas.Operations, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.Kind).HasMaxLength(32);
            e.Property(x => x.FromParty).HasMaxLength(256);
            e.Property(x => x.ToParty).HasMaxLength(256);
            e.Property(x => x.ToUserId).HasMaxLength(450);
            e.Property(x => x.LetterNumber).HasMaxLength(128);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.ConfirmedByUserId).HasMaxLength(450);
            e.Property(x => x.ConfirmedByName).HasMaxLength(256);
            e.Property(x => x.CreatedByUserId).HasMaxLength(450);
            e.Property(x => x.CreatedByName).HasMaxLength(256);
            e.HasIndex(x => x.EnvelopeId);
            e.HasIndex(x => x.Status);
        });

        builder.Entity<KeyEnvelopeTimelineEntry>(e =>
        {
            MapTable(e, "KeyEnvelopeTimelineEntries", DatabaseSchemas.Operations, ownsMigrations);
            e.Property(x => x.EventType).HasMaxLength(64);
            e.Property(x => x.Summary).HasMaxLength(1000);
            e.Property(x => x.ActorUserId).HasMaxLength(450);
            e.Property(x => x.ActorName).HasMaxLength(256);
            e.HasIndex(x => new { x.EnvelopeId, x.CreatedAtUtc });
        });

        builder.Entity<PropertyCourtAccess>(e =>
        {
            MapTable(e, "PropertyCourtAccesses", DatabaseSchemas.Operations, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.DeedNumber).HasMaxLength(128);
            e.Property(x => x.RequestNumber).HasMaxLength(128);
            e.Property(x => x.StudyHoldStatus).HasMaxLength(32);
            e.Property(x => x.ContactPhones).HasMaxLength(1000);
            e.Property(x => x.Notes).HasMaxLength(4000);
            e.Property(x => x.UpdatedByUserId).HasMaxLength(450);
            e.Property(x => x.UpdatedByName).HasMaxLength(256);
            e.HasIndex(x => x.PropertyId).IsUnique();
            e.HasIndex(x => x.RequestNumber);
            e.HasIndex(x => x.StudyHoldStatus);
        });

 // D2: task lifecycle is operations-owned while rows stay in case_study physically.
        builder.Entity<OperationsTask>(e =>
        {
            MapTable(e, "OperationsTasks", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.UseOptimisticConcurrency();
            e.Property(x => x.DisplayId).HasMaxLength(32);
            e.Property(x => x.Type)
                .HasConversion(DomainEnumConverters.OperationsTaskType)
                .HasMaxLength(32);
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.Description).HasMaxLength(4000);
            e.Property(x => x.Scope)
                .HasConversion(DomainEnumConverters.OperationsTaskScope)
                .HasMaxLength(32);
            e.Property(x => x.DeedsJson).HasColumnType("jsonb");
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.AssigneeId).HasMaxLength(128);
            e.Property(x => x.AssigneeName).HasMaxLength(256);
            e.Property(x => x.CreatedBy).HasMaxLength(128);
            e.Property(x => x.CreatedByName).HasMaxLength(256);
            e.Property(x => x.Status)
                .HasConversion(DomainEnumConverters.OperationsTaskStatus)
                .HasMaxLength(32);
            e.Property(x => x.PrevStatus)
                .HasConversion(DomainEnumConverters.OperationsTaskStatus)
                .HasMaxLength(32);
            e.Property(x => x.Priority)
                .HasConversion(DomainEnumConverters.OperationsTaskPriority)
                .HasMaxLength(16);
            e.Property(x => x.Reference).HasMaxLength(64);
            e.Property(x => x.LetterRowsJson).HasColumnType("jsonb");
            e.Property(x => x.CommentsJson).HasColumnType("jsonb");
            e.Property(x => x.RemindersJson).HasColumnType("jsonb");
            e.Property(x => x.CourtVisitResultJson).HasColumnType("jsonb");
            e.Property(x => x.AgreedVisitFeeSar).HasPrecision(12, 2);
            e.Property(x => x.PauseReason).HasMaxLength(2000);
            e.Property(x => x.CancelReason).HasMaxLength(2000);
            e.Property(x => x.OriginalAssigneeId).HasMaxLength(128);
            e.Property(x => x.OriginalAssigneeName).HasMaxLength(256);
            e.Property(x => x.CreditAssigneeId).HasMaxLength(128);
            e.Property(x => x.CreditAssigneeName).HasMaxLength(256);
            e.HasIndex(x => x.DisplayId).IsUnique();
            e.HasIndex(x => x.AssigneeId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.DueAtUtc);
            e.HasIndex(x => x.CreatedBy);
            e.HasIndex(x => x.PoNumber);
        });

        builder.Entity<OperationsTaskSequence>(e =>
        {
            MapTable(e, "OperationsTaskSequences", DatabaseSchemas.CaseStudy, ownsMigrations);
            e.HasIndex(x => x.Year).IsUnique();
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
