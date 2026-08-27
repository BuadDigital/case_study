using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class ValuationDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<ValuationDbContext>
{
    protected override ValuationDbContext Create(DbContextOptions<ValuationDbContext> options) =>
        new(options);
}
