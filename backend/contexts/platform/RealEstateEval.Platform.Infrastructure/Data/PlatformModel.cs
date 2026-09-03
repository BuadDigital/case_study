using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>platform</c> schema mapping: court catalogs, the geography catalog, and the two
/// configuration singletons. Applied by <see cref="PlatformDbContext"/>, which owns the write
/// path, and by the legacy context, which still serves cross-boundary reference reads until
/// a cacheable Platform API or versioned snapshot replaces them.
/// </summary>
// A8: public — the owner context lives in its context library; this shared mapping stays
// global beside the frozen legacy context (drift guard).
public static class PlatformModel
{
 /// <param name="ownsMigrations">
 /// True only for <see cref="PlatformDbContext"/>. The legacy context mirrors platform tables
 /// for cross-boundary reads and must not scaffold create/alter ops for tables Platform owns
 /// (e.g. OrganizationSettings, FieldSyncStatuses).
 /// </param>
    public static ModelBuilder ApplyPlatformModel(this ModelBuilder builder, bool ownsMigrations = true)
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
            e.HasIndex(x => x.OfficialId).IsUnique();
            e.HasIndex(x => x.AdminAreaId).IsUnique();
            e.HasIndex(x => x.IsActive);
            e.HasMany(x => x.Cities)
                .WithOne(x => x.Region)
                .HasForeignKey(x => x.RegionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<City>(e =>
        {
            e.ToTable("Cities", DatabaseSchemas.Platform);
            e.Property(x => x.NameAr).HasMaxLength(150).IsRequired();
            e.Property(x => x.NameEn).HasMaxLength(150);
            e.Property(x => x.NameSearch).HasMaxLength(150).IsRequired();
            e.Property(x => x.Status).HasMaxLength(16).IsRequired();
            e.Property(x => x.RawInput).HasMaxLength(150);
            e.Property(x => x.CreatedByUserId).HasMaxLength(128);
            e.Property(x => x.ReviewedByUserId).HasMaxLength(128);
 // Official national IDs are unique when present; pending suggestions have null.
            e.HasIndex(x => x.OfficialId)
                .IsUnique()
                .HasFilter("\"OfficialId\" IS NOT NULL");
            e.HasIndex(x => x.NameSearch);
            e.HasIndex(x => new { x.RegionId, x.IsGovernorate });
            e.HasIndex(x => new { x.RegionId, x.Status });
            e.HasIndex(x => x.IsActive);
            e.HasOne(x => x.MergedIntoCity)
                .WithMany()
                .HasForeignKey(x => x.MergedIntoCityId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Districts)
                .WithOne(x => x.City)
                .HasForeignKey(x => x.CityId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<District>(e =>
        {
            if (ownsMigrations)
                e.ToTable("Districts", DatabaseSchemas.Platform);
            else
                e.ToTable("Districts", DatabaseSchemas.Platform, t => t.ExcludeFromMigrations());

            e.Property(x => x.NameAr).HasMaxLength(150).IsRequired();
            e.Property(x => x.NameSearch).HasMaxLength(150).IsRequired();
            e.Property(x => x.Status).HasMaxLength(16).IsRequired();
            e.Property(x => x.RawInput).HasMaxLength(150);
            e.Property(x => x.CreatedByUserId).HasMaxLength(128);
            e.Property(x => x.ReviewedByUserId).HasMaxLength(128);
            e.HasIndex(x => x.NameSearch);
            e.HasIndex(x => new { x.CityId, x.Status });
            e.HasIndex(x => x.IsActive);
            e.HasOne(x => x.MergedIntoDistrict)
                .WithMany()
                .HasForeignKey(x => x.MergedIntoDistrictId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<FieldDictionaryConfig>(e =>
        {
            e.ToTable("FieldDictionaryConfigs", DatabaseSchemas.Platform);
            e.Property(x => x.StateJson).HasColumnType("jsonb");
        });

        builder.Entity<AttachmentPrintDictionaryConfig>(e =>
        {
            if (ownsMigrations)
                e.ToTable("AttachmentPrintDictionaryConfigs", DatabaseSchemas.Platform);
            else
                e.ToTable(
                    "AttachmentPrintDictionaryConfigs",
                    DatabaseSchemas.Platform,
                    t => t.ExcludeFromMigrations());

            e.Property(x => x.CatalogJson).HasColumnType("jsonb");
        });

        builder.Entity<DifferenceFactorCatalogConfig>(e =>
        {
            if (ownsMigrations)
                e.ToTable("DifferenceFactorCatalogConfigs", DatabaseSchemas.Platform);
            else
                e.ToTable(
                    "DifferenceFactorCatalogConfigs",
                    DatabaseSchemas.Platform,
                    t => t.ExcludeFromMigrations());

            e.Property(x => x.CatalogJson).HasColumnType("jsonb");
        });

        builder.Entity<CaseStudyInfoRolesConfig>(e =>
        {
            e.ToTable("CaseStudyInfoRolesConfigs", DatabaseSchemas.Platform);
            e.Property(x => x.MatrixJson).HasColumnType("jsonb");
            e.Property(x => x.NotesJson).HasColumnType("jsonb");
        });

        // Decision 23: standard-text package version history — immutable rows, one version per package.
        builder.Entity<ValuationReportTextPackage>(e =>
        {
            if (ownsMigrations)
                e.ToTable("ValuationReportTextPackages", DatabaseSchemas.Platform);
            else
                e.ToTable("ValuationReportTextPackages", DatabaseSchemas.Platform, t => t.ExcludeFromMigrations());
            e.Property(x => x.TextsJson).IsRequired();
            e.Property(x => x.CreatedByUserId).HasMaxLength(128);
            e.HasIndex(x => x.Version).IsUnique();
        });

        builder.Entity<OrganizationSettings>(e =>
        {
            if (ownsMigrations)
                e.ToTable("OrganizationSettings", DatabaseSchemas.Platform);
            else
                e.ToTable("OrganizationSettings", DatabaseSchemas.Platform, t => t.ExcludeFromMigrations());

            e.Property(x => x.SettingsJson).HasColumnType("jsonb");
        });

        builder.Entity<FieldSyncStatus>(e =>
        {
            if (ownsMigrations)
                e.ToTable("FieldSyncStatuses", DatabaseSchemas.Platform);
            else
                e.ToTable("FieldSyncStatuses", DatabaseSchemas.Platform, t => t.ExcludeFromMigrations());

            e.HasIndex(x => x.UserId).IsUnique();
            e.Property(x => x.UserId).HasMaxLength(128);
            e.Property(x => x.DisplayName).HasMaxLength(256);
            e.Property(x => x.RoleId).HasMaxLength(64);
            e.Property(x => x.KindsJson).HasColumnType("jsonb");
        });

        return builder;
    }
}
