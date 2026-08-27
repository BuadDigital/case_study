using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Identity.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class IdentityDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<IdentityDbContext>
{
    protected override IdentityDbContext Create(DbContextOptions<IdentityDbContext> options) =>
        new(options);
}
