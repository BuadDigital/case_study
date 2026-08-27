using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class FailuresDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<FailuresDbContext>
{
    protected override FailuresDbContext Create(DbContextOptions<FailuresDbContext> options) =>
        new(options);
}
