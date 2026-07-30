using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Identity bounded context (plan Phase 1, extraction order step 2).
/// Inherits ASP.NET Identity's store context and maps the existing tables in the existing
/// <c>identity</c> schema — this phase changes which context holds the write path, not where
/// a row lives.
/// </summary>
public sealed class IdentityDbContext(DbContextOptions<IdentityDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<HrEmployeeProfile> HrEmployeeProfiles => Set<HrEmployeeProfile>();
    public DbSet<ProcServiceProviderProfile> ProcServiceProviderProfiles =>
        Set<ProcServiceProviderProfile>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder
            .ApplyIdentityModel()
            .ApplyAuditModel(ownsMigrations: false);
    }
}
