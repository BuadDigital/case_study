using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>failures</c> schema mapping. Applied by <see cref="FailuresDbContext"/> (write path)
/// and by the legacy context (transitional Case Study / billing reads until owner APIs replace them).
/// </summary>
// A8: public — the owner context lives in its context library; this shared mapping stays
// global beside the frozen legacy context (drift guard).
public static class FailuresModel
{
    public static ModelBuilder ApplyFailuresModel(this ModelBuilder builder, bool ownsMigrations = true)
    {
        builder.Entity<PropertyFailure>(e =>
        {
            if (ownsMigrations)
                e.ToTable("PropertyFailures", DatabaseSchemas.Failures);
            else
                e.ToTable("PropertyFailures", DatabaseSchemas.Failures, t => t.ExcludeFromMigrations());

            e.UseOptimisticConcurrency();
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
            e.Property(x => x.SuspendedByUserId).HasMaxLength(450);
            e.HasIndex(x => x.PoNumber);
            e.HasIndex(x => new { x.PoNumber, x.PropertyId });
            e.HasIndex(x => x.Status);
        });

        builder.Entity<FailureTypesCatalogConfig>(e =>
        {
            if (ownsMigrations)
                e.ToTable("FailureTypesCatalogConfigs", DatabaseSchemas.Failures);
            else
                e.ToTable(
                    "FailureTypesCatalogConfigs",
                    DatabaseSchemas.Failures,
                    t => t.ExcludeFromMigrations());

            e.Property(x => x.CatalogJson).HasColumnType("jsonb");
        });

        return builder;
    }
}
