using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Financial.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class FinancialDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<FinancialDbContext>
{
    protected override FinancialDbContext Create(DbContextOptions<FinancialDbContext> options) =>
        new(options);
}
