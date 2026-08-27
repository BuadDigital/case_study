using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Failures.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class FailuresDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<FailuresDbContext>
{
    protected override FailuresDbContext Create(DbContextOptions<FailuresDbContext> options) =>
        new(options);
}
