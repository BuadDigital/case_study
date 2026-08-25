using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class AttachmentLookup(AttachmentsDbContext db) : IAttachmentLookup
{
    private const int MaxLookupIds = 200;
    private const int MaxPropertyRows = 200;

    public async Task<bool> ExistsAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var row = await db.FileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (row is null)
            return false;
        return actor is null || AttachmentAccessRules.Allows(row.UploadedByUserId, actor);
    }

    public async Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        if (ids.Count == 0)
            return [];

        var limited = ids.Distinct().Take(MaxLookupIds).ToArray();
        var rows = await db.FileAttachments.AsNoTracking()
            .Where(x => limited.Contains(x.Id))
            .ToListAsync(cancellationToken);

        return rows
            .Where(x => actor is null || AttachmentAccessRules.Allows(x.UploadedByUserId, actor))
            .Select(x => new AttachmentRefDto
            {
                Id = x.Id,
                Scope = x.Scope,
                ScopeKey = x.ScopeKey,
            })
            .ToList();
    }

    public async Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var needle = propertyId.Trim();
        if (needle.Length == 0)
            return [];

        var colon = needle + ":";
        var slash = needle + "/";
        var rows = await db.FileAttachments.AsNoTracking()
            .Where(a =>
                a.ScopeKey == needle
                || a.ScopeKey.StartsWith(colon)
                || a.ScopeKey.StartsWith(slash))
            .OrderBy(a => a.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        rows = rows
            .Where(a => actor is null || AttachmentAccessRules.Allows(a.UploadedByUserId, actor))
            .Take(MaxPropertyRows)
            .ToList();

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
