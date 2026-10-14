using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Attachments.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Attachments.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for the Attachments bounded context.
/// It maps the existing table in the existing schema: this phase changes which context holds
/// the write path, not where a row lives.
/// </summary>
public sealed class AttachmentsDbContext(DbContextOptions<AttachmentsDbContext> options)
    : DbContext(options), ICommandIdempotencyDbContext
{
    public DbSet<FileAttachment> FileAttachments => Set<FileAttachment>();
    public DbSet<PhotoMetadata> PhotoMetadata => Set<PhotoMetadata>();
    public DbSet<CommandIdempotencyRecord> CommandIdempotencyRecords =>
        Set<CommandIdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder
            .ApplyAttachmentsModel()
            .ApplyCommandIdempotencyModel();
}
