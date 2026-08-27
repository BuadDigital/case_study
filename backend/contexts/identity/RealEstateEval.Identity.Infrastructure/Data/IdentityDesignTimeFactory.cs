using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class IdentityDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<IdentityDbContext>
{
    protected override IdentityDbContext Create(DbContextOptions<IdentityDbContext> options) =>
        new(options);
}
