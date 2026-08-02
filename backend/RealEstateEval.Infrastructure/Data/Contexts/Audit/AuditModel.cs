using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The append-only audit ledger. Rows are owned per producer: identity, platform and the legacy
/// context each append their own and never read or mutate another's, which is why the table sits
/// in a schema of its own — a writer can be granted INSERT on this one table instead of a whole
/// owner's schema (split plan, decision D7).
/// </summary>
internal static class AuditModel
{
    /// <param name="ownsMigrations">
    /// True only for the context whose migration stream creates the table. Every other context
    /// maps it read/append-only and must not scaffold it, or two streams would both try to
    /// create the same table.
    /// </param>
    public static ModelBuilder ApplyAuditModel(this ModelBuilder builder, bool ownsMigrations)
    {
        builder.Entity<AuditLog>(e =>
        {
            if (ownsMigrations)
                e.ToTable("AuditLogs", DatabaseSchemas.Audit);
            else
                e.ToTable("AuditLogs", DatabaseSchemas.Audit, t => t.ExcludeFromMigrations());

            e.Property(x => x.ActorId).HasMaxLength(128).IsRequired();
            e.Property(x => x.Action).HasMaxLength(128).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(64).IsRequired();
            e.Property(x => x.EntityId).HasMaxLength(128).IsRequired();
            e.Property(x => x.BeforeJson).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.AfterJson).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x => new { x.EntityType, x.EntityId });
            e.HasIndex(x => x.ActorId);
            e.HasIndex(x => x.Action);
            e.HasIndex(x => x.CreatedAtUtc);
        });

        return builder;
    }
}
