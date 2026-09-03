using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Attachments bounded context.
/// It maps the existing table in the existing schema: this phase changes which context holds
/// the write path, not where a row lives.
/// </summary>
public sealed class AttachmentsDbContext(DbContextOptions<AttachmentsDbContext> options)
    : DbContext(options)
{
    public DbSet<FileAttachment> FileAttachments => Set<FileAttachment>();
    public DbSet<PhotoMetadata> PhotoMetadata => Set<PhotoMetadata>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyAttachmentsModel();
}
