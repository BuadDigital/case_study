using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Failures bounded context.
/// Maps existing tables in the existing <c>failures</c> schema.
/// </summary>
public sealed class FailuresDbContext(DbContextOptions<FailuresDbContext> options) : DbContext(options)
{
    public DbSet<PropertyFailure> PropertyFailures => Set<PropertyFailure>();
    public DbSet<FailureTypesCatalogConfig> FailureTypesCatalogConfigs =>
        Set<FailureTypesCatalogConfig>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyFailuresModel();
}
