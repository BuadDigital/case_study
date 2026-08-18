using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class AttachmentLookup(AttachmentsDbContext db) : IAttachmentLookup
{
    private const int MaxLookupIds = 200;
    private const int MaxPropertyRows = 200;

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.FileAttachments.AsNoTracking().AnyAsync(a => a.Id == id, cancellationToken);

    public async Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        CancellationToken cancellationToken = default)
    {
        if (ids.Count == 0)
            return [];

        var limited = ids.Distinct().Take(MaxLookupIds).ToArray();
        return await db.FileAttachments.AsNoTracking()
            .Where(x => limited.Contains(x.Id))
            .Select(x => new AttachmentRefDto
            {
                Id = x.Id,
                Scope = x.Scope,
                ScopeKey = x.ScopeKey,
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var needle = propertyId.Trim();
        if (needle.Length == 0)
            return [];

        var rows = await db.FileAttachments.AsNoTracking()
            .Where(a => a.ScopeKey.Contains(needle))
            .OrderBy(a => a.CreatedAtUtc)
            .Take(MaxPropertyRows)
            .ToListAsync(cancellationToken);

        var rowIds = rows.Select(r => r.Id).ToList();
        var photos = rowIds.Count == 0
            ? new Dictionary<Guid, Domain.PhotoMetadata>()
            : await db.PhotoMetadata.AsNoTracking()
                .Where(p => rowIds.Contains(p.PhotoId))
                .ToDictionaryAsync(p => p.PhotoId, cancellationToken);

        return rows.Select(row =>
        {
            photos.TryGetValue(row.Id, out var photo);
            return new FileAttachmentMetaDto
            {
                Id = row.Id,
                Scope = row.Scope,
                ScopeKey = row.ScopeKey,
                FileName = row.FileName,
                ContentType = row.ContentType,
                SizeBytes = row.SizeBytes,
                CreatedAtUtc = row.CreatedAtUtc,
                DictionaryTypeKey = row.DictionaryTypeKey ?? "",
                PrintInReport = row.PrintInReport,
                PhotoMetadata = photo is null
                    ? null
                    : new PhotoMetadataDto
                    {
                        Latitude = photo.Latitude,
                        Longitude = photo.Longitude,
                        CapturedAtUtc = photo.CapturedAtUtc,
                        DistanceM = photo.DistanceM,
                        Flag = photo.Flag,
                    },
            };
        }).ToList();
    }
}
