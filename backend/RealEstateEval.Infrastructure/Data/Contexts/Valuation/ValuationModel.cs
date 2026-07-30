using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>valuation</c> schema mapping and the display-id sequence. Applied by
/// <see cref="ValuationDbContext"/>, which owns the write path, and by the legacy context,
/// which still serves the Case Study dispatch pre-check until plan Phase 3 replaces it with
/// a Valuation owner call.
/// </summary>
internal static class ValuationModel
{
    public static ModelBuilder ApplyValuationModel(this ModelBuilder builder)
    {
        builder.Entity<ValuationRequest>(e =>
        {
            e.ToTable("ValuationRequests", DatabaseSchemas.Valuation);
            e.UseOptimisticConcurrency();
            e.Property(x => x.DisplayId).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.Area).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.Property(x => x.Appraiser).HasMaxLength(256);
            e.Property(x => x.Status)
                .HasConversion(DomainEnumConverters.ValuationRequestStatus)
                .HasMaxLength(32);
            e.Property(x => x.RequestDate).HasMaxLength(32);
            e.HasIndex(x => x.DisplayId)
                .IsUnique()
                .HasDatabaseName(DatabaseIndexNames.ValuationRequestDisplayId);
            // One open request per property is the dispatch rule; a partial unique index both
            // enforces it against concurrent inserts and serves the "is one already open?" probe.
            e.HasIndex(x => x.PropertyId)
                .IsUnique()
                .HasFilter($"\"Status\" <> '{ValuationRequestStatuses.Done}'")
                .HasDatabaseName(DatabaseIndexNames.ValuationRequestOpenPerProperty);
        });

        builder.Entity<EvaluatorRecallRecord>(e =>
        {
            e.ToTable("EvaluatorRecallRecords", DatabaseSchemas.Valuation);
            e.UseOptimisticConcurrency();
            e.Property(x => x.TaskId).HasMaxLength(64);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.Reason).HasMaxLength(4000);
            e.Property(x => x.SpecialistNote).HasMaxLength(4000);
            e.HasIndex(x => x.TaskId).IsUnique();
            e.HasIndex(x => x.Status);
        });

        builder.HasSequence<int>(
                DatabaseSequences.ValuationRequestDisplayId,
                DatabaseSchemas.Valuation)
            .StartsAt(DatabaseSequences.ValuationRequestDisplayIdStart)
            .IncrementsBy(1);

        return builder;
    }
}
