using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Attachments bounded context (plan Phase 1, extraction order step 1).
/// It maps the existing table in the existing schema: this phase changes which context holds
/// the write path, not where a row lives.
/// </summary>
public sealed class AttachmentsDbContext(DbContextOptions<AttachmentsDbContext> options)
    : DbContext(options)
{
    public DbSet<FileAttachment> FileAttachments => Set<FileAttachment>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyAttachmentsModel();
}
