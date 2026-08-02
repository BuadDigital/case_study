using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Platform catalogs (plan Phase 1, extraction order step 1): courts,
/// circuits, the geography catalog, and the two configuration singletons.
/// <para>
/// <c>messaging.UserNotifications</c> is Platform-owned (decision D3) but stays on the legacy
/// context until the messaging slice, so the notification inbox and its dispatcher move
/// together rather than in two half-steps.
/// </para>
/// </summary>
public sealed class PlatformDbContext(DbContextOptions<PlatformDbContext> options)
    : DbContext(options)
{
    public DbSet<CourtCatalogEntry> CourtCatalogEntries => Set<CourtCatalogEntry>();
    public DbSet<Court> Courts => Set<Court>();
    public DbSet<CourtCircuit> CourtCircuits => Set<CourtCircuit>();
    public DbSet<CourtAuditLog> CourtAuditLogs => Set<CourtAuditLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Region> Regions => Set<Region>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<District> Districts => Set<District>();
    public DbSet<FieldDictionaryConfig> FieldDictionaryConfigs => Set<FieldDictionaryConfig>();
    public DbSet<CaseStudyInfoRolesConfig> CaseStudyInfoRolesConfigs => Set<CaseStudyInfoRolesConfig>();
    public DbSet<OrganizationSettings> OrganizationSettings => Set<OrganizationSettings>();
    public DbSet<FieldSyncStatus> FieldSyncStatuses => Set<FieldSyncStatus>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder
            .ApplyPlatformModel()
            .ApplyAuditModel(ownsMigrations: true);
}
