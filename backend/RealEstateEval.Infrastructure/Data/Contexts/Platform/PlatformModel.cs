using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>platform</c> schema mapping: court catalogs, the geography catalog, and the two
/// configuration singletons. Applied by <see cref="PlatformDbContext"/>, which owns the write
/// path, and by the legacy context, which still serves cross-boundary reference reads until
/// plan Phase 3 replaces them with a cacheable Platform API or a versioned snapshot.
/// </summary>
internal static class PlatformModel
{
    public static ModelBuilder ApplyPlatformModel(this ModelBuilder builder)
    {
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

        builder.Entity<CourtAuditLog>(e =>
        {
            e.ToTable("CourtAuditLogs", DatabaseSchemas.Platform);
            e.Property(x => x.Action).HasMaxLength(64).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(32).IsRequired();
            e.Property(x => x.ActorId).HasMaxLength(128).IsRequired();
            e.Property(x => x.ChangesJson).HasColumnType("jsonb");
            e.HasIndex(x => new { x.EntityType, x.EntityId });
            e.HasIndex(x => x.TimestampUtc);
            e.HasIndex(x => x.Action);
        });

        builder.Entity<Region>(e =>
        {
            e.ToTable("Regions", DatabaseSchemas.Platform);
            e.Property(x => x.Code).HasMaxLength(4).IsRequired();
            e.Property(x => x.NameAr).HasMaxLength(100).IsRequired();
            e.Property(x => x.CapitalAr).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => x.IsActive);
            e.HasMany(x => x.Cities)
                .WithOne(x => x.Region)
                .HasForeignKey(x => x.RegionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<City>(e =>
        {
            e.ToTable("Cities", DatabaseSchemas.Platform);
            e.Property(x => x.NameAr).HasMaxLength(100).IsRequired();
            e.HasIndex(x => new { x.RegionId, x.NameAr }).IsUnique();
            e.HasIndex(x => x.IsActive);
        });

        builder.Entity<FieldDictionaryConfig>(e =>
        {
            e.ToTable("FieldDictionaryConfigs", DatabaseSchemas.Platform);
            e.Property(x => x.StateJson).HasColumnType("jsonb");
        });

        builder.Entity<CaseStudyInfoRolesConfig>(e =>
        {
            e.ToTable("CaseStudyInfoRolesConfigs", DatabaseSchemas.Platform);
            e.Property(x => x.MatrixJson).HasColumnType("jsonb");
            e.Property(x => x.NotesJson).HasColumnType("jsonb");
        });

        builder.Entity<OrganizationSettings>(e =>
        {
            e.ToTable("OrganizationSettings", DatabaseSchemas.Platform);
            e.Property(x => x.SettingsJson).HasColumnType("jsonb");
        });

        return builder;
    }
}
