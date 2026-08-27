using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>attachments</c> schema mapping. Applied by <see cref="AttachmentsDbContext"/>, which
/// owns the write path, and by the legacy context, which still serves the existence checks
/// until the Attachments API replaces them. A single definition is what keeps the
/// two mappings from drifting while both exist.
/// </summary>
// A8 physical move: public — the owner context now lives in the Attachments context library
// while this shared mapping stays global beside the frozen legacy context (drift guard).
public static class AttachmentsModel
{
    public static ModelBuilder ApplyAttachmentsModel(this ModelBuilder builder)
    {
        builder.Entity<FileAttachment>(e =>
        {
            e.ToTable("FileAttachments", DatabaseSchemas.Attachments);
            e.Property(x => x.Scope).HasMaxLength(64);
            e.Property(x => x.ScopeKey).HasMaxLength(512);
            e.Property(x => x.FileName).HasMaxLength(512);
            e.Property(x => x.ContentType).HasMaxLength(128);
            e.Property(x => x.StorageKey).HasMaxLength(1024);
            e.Property(x => x.UploadedByUserId).HasMaxLength(450);
            e.HasIndex(x => new { x.Scope, x.ScopeKey });
        });

        builder.Entity<PhotoMetadata>(e =>
        {
            e.ToTable("PhotoMetadata", DatabaseSchemas.Attachments);
            e.HasKey(x => x.Id);
            e.Property(x => x.Flag).HasMaxLength(64);
            e.HasIndex(x => x.PhotoId).IsUnique();
        });

        return builder;
    }
}
