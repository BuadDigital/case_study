using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Platform.Infrastructure.Data.Contexts;

/// <summary>Physical move: design-time factory lives beside its context library.</summary>
public sealed class PlatformDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<PlatformDbContext>
{
    protected override PlatformDbContext Create(DbContextOptions<PlatformDbContext> options) =>
        new(options);
}
