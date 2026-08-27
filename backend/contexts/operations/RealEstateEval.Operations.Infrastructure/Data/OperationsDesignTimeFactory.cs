using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class OperationsDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<OperationsDbContext>
{
    protected override OperationsDbContext Create(DbContextOptions<OperationsDbContext> options) =>
        new(options);
}
