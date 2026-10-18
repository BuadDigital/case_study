using RealEstateEval.Application;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Attachments.Infrastructure.Services;

public sealed partial class AttachmentService
{
    private const int MaxScopeCopyRows = 500;

    /// <summary>
    /// Copies every row whose scope key starts with the "from" prefix to the same suffix under
    /// the "to" prefix: a fresh id, a fresh blob, the photo metadata (location, distance, flag)
    /// carried over, the caller as uploader. A suffix + file name already present under the
    /// "to" prefix is skipped, so a repeated call adds nothing. Rows whose bytes are gone are
    /// skipped too and simply absent from the result.
    /// </summary>
    public async Task<IReadOnlyList<CopiedAttachmentDto>> CopyScopeAsync(
        CopyAttachmentScopeRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var scope = (request.Scope ?? "").Trim();
        var fromPrefix = (request.FromScopeKeyPrefix ?? "").Trim();
        var toPrefix = (request.ToScopeKeyPrefix ?? "").Trim();
        if (scope.Length == 0 || fromPrefix.Length == 0 || toPrefix.Length == 0 || fromPrefix == toPrefix)
            return [];

        var sources = await _db.FileAttachments.AsNoTracking()
            .Where(x => x.Scope == scope && x.ScopeKey.StartsWith(fromPrefix))
            .OrderBy(x => x.CreatedAtUtc)
            .Take(MaxScopeCopyRows)
            .ToListAsync(cancellationToken);
        if (sources.Count == 0)
            return [];

        var existing = await _db.FileAttachments.AsNoTracking()
            .Where(x => x.Scope == scope && x.ScopeKey.StartsWith(toPrefix))
            .Select(x => new { x.ScopeKey, x.FileName })
            .ToListAsync(cancellationToken);
        var taken = existing.Select(x => (x.ScopeKey, x.FileName)).ToHashSet();

        var sourceIds = sources.Select(s => s.Id).ToList();
        var photos = await _db.PhotoMetadata.AsNoTracking()
            .Where(p => sourceIds.Contains(p.PhotoId))
            .ToDictionaryAsync(p => p.PhotoId, cancellationToken);

        var now = _time.UtcNow();
        var uploader = string.IsNullOrWhiteSpace(actorUserId) ? "system" : actorUserId.Trim();
        var copied = new List<CopiedAttachmentDto>();
        foreach (var source in sources)
        {
            var suffix = source.ScopeKey[fromPrefix.Length..];
            var toKey = toPrefix + suffix;
            if (toKey.Length > 512 || taken.Contains((toKey, source.FileName)))
                continue;
            if (string.IsNullOrWhiteSpace(source.StorageKey))
                continue;

            var content = await _blobs.ReadAsync(source.StorageKey, cancellationToken);
            if (content is null)
                continue;

            var id = Guid.NewGuid();
            var storageKey = await _blobs.SaveAsync(
                BlobContainer,
                $"{id:N}/{source.FileName}",
                content,
                cancellationToken);

            _db.FileAttachments.Add(new FileAttachment
            {
                Id = id,
                Scope = scope,
                ScopeKey = toKey,
                FileName = source.FileName,
                ContentType = source.ContentType,
                StorageKey = storageKey,
                SizeBytes = source.SizeBytes,
                UploadedByUserId = uploader,
                CreatedAtUtc = now,
                DocumentTypeKey = source.DocumentTypeKey,
                CustomDocumentLabel = source.CustomDocumentLabel,
                CustomDocumentReason = source.CustomDocumentReason,
            });
            if (photos.TryGetValue(source.Id, out var photo))
            {
                _db.PhotoMetadata.Add(new PhotoMetadata
                {
                    Id = Guid.NewGuid(),
                    PhotoId = id,
                    Latitude = photo.Latitude,
                    Longitude = photo.Longitude,
                    CapturedAtUtc = photo.CapturedAtUtc,
                    DistanceM = photo.DistanceM,
                    Flag = photo.Flag,
                    CreatedAtUtc = now,
                });
            }

            taken.Add((toKey, source.FileName));
            copied.Add(new CopiedAttachmentDto
            {
                FromId = source.Id,
                ToId = id,
                ScopeKey = toKey,
                FileName = source.FileName,
            });
        }

        if (copied.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);
        return copied;
    }
}
