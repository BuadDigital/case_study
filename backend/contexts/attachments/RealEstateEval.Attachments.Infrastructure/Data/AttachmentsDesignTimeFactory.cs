using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts;

/// <summary>A8 physical move: design-time factory lives beside its context library.</summary>
public sealed class AttachmentsDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<AttachmentsDbContext>
{
    protected override AttachmentsDbContext Create(DbContextOptions<AttachmentsDbContext> options) =>
        new(options);
}
