using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class CaseStudyDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<CaseStudyDbContext>
{
    protected override CaseStudyDbContext Create(DbContextOptions<CaseStudyDbContext> options) =>
        new(options);
}
