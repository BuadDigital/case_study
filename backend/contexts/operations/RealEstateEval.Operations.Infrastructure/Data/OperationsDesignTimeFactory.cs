using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Operations.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class OperationsDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<OperationsDbContext>
{
    protected override OperationsDbContext Create(DbContextOptions<OperationsDbContext> options) =>
        new(options);
}
