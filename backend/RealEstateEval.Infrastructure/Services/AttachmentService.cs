using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class AttachmentService : IAttachmentService
{
    private const string BlobContainer = "attachments";
    private const int MaxAttachmentsPerScope = 200;

    /// <summary>Base64 inflates by 4/3; allow a little slack for padding and whitespace.</summary>
    private const int MaxBase64Length =
        (int)(AttachmentUploadRules.DefaultMaxBytes / 3 + 1) * 4 + 1024;
    private readonly AttachmentsDbContext _db;
    private readonly IBlobStorage _blobs;
    private readonly IAttachmentPrintDictionaryService? _printDictionary;

    public AttachmentService(
        AttachmentsDbContext db,
        IBlobStorage blobs,
        IAttachmentPrintDictionaryService? printDictionary = null)
    {
        _db = db;
        _blobs = blobs;
        _printDictionary = printDictionary;
    }

    public async Task<IReadOnlyList<FileAttachmentMetaDto>> ListAsync(
        string scope,
        string scopeKey,
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.FileAttachments.AsNoTracking()
            .Where(x => x.Scope == scope.Trim() && x.ScopeKey == scopeKey.Trim())
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxAttachmentsPerScope)
            .ToListAsync(cancellationToken);
        var ids = rows.Select(r => r.Id).ToList();
        var photos = ids.Count == 0
            ? new Dictionary<Guid, PhotoMetadata>()
            : await _db.PhotoMetadata.AsNoTracking()
                .Where(p => ids.Contains(p.PhotoId))
                .ToDictionaryAsync(p => p.PhotoId, cancellationToken);
        return rows.Select(row => ToMeta(row, photos.GetValueOrDefault(row.Id))).ToList();
    }

    public async Task<(byte[]? Content, FileAttachmentMetaDto? Meta)> GetContentAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return (null, null);

        var content = await ReadContentAsync(row, cancellationToken);
        if (content is null) return (null, null);

        // Rows written before content verification may carry a client-chosen MIME type.
        // Serve what the bytes actually are, or nothing the browser will render.
        var format = FileSignatureInspector.Detect(content);
        return (content, ToMeta(row, contentTypeOverride: FileSignatureInspector.CanonicalMime(format)));
    }

    public async Task<(FileAttachmentMetaDto? Meta, string? Error)> UploadAsync(
        UploadAttachmentRequest request,
        string uploadedByUserId,
        CancellationToken cancellationToken = default)
    {
        // Reject implausibly large payloads before allocating the decoded buffer.
        if (request.ContentBase64.Length > MaxBase64Length)
            return (null, "حجم الملف يتجاوز الحد المسموح");

        byte[] content;
        try
        {
            content = Convert.FromBase64String(request.ContentBase64);
        }
        catch
        {
            return (null, "invalid base64 content");
        }

        var inspection = AttachmentUploadRules.Inspect(
            request.Scope,
            request.ContentType,
            request.FileName,
            content);
        if (inspection.Error is not null)
            return (null, inspection.Error);

        var id = Guid.NewGuid();
        var safeName = inspection.FileName;

        var storageKey = await _blobs.SaveAsync(
            BlobContainer,
            $"{id:N}/{safeName}",
            content,
            cancellationToken);

        var row = new FileAttachment
        {
            Id = id,
            Scope = request.Scope.Trim(),
            ScopeKey = request.ScopeKey.Trim(),
            FileName = safeName,
            // Persist the verified type, so downloads can never echo a client-chosen MIME.
            ContentType = inspection.ContentType,
            StorageKey = storageKey,
            Content = null,
            SizeBytes = content.LongLength,
            UploadedByUserId = uploadedByUserId,
            CreatedAtUtc = DateTime.UtcNow,
        };
        _db.FileAttachments.Add(row);

        if (request.PhotoMetadata is not null
            && IsEvidencePhotoScope(row.Scope))
        {
            var (distanceM, flag) = PhotoLocationRules.Evaluate(
                request.PhotoMetadata.Latitude,
                request.PhotoMetadata.Longitude,
                request.PhotoMetadata.PropertyLatitude,
                request.PhotoMetadata.PropertyLongitude);
            var photoMeta = new PhotoMetadata
            {
                Id = Guid.NewGuid(),
                PhotoId = id,
                Latitude = request.PhotoMetadata.Latitude,
                Longitude = request.PhotoMetadata.Longitude,
                CapturedAtUtc = request.PhotoMetadata.CapturedAtUtc,
                DistanceM = distanceM,
                Flag = flag,
                CreatedAtUtc = DateTime.UtcNow,
            };
            _db.PhotoMetadata.Add(photoMeta);
            await _db.SaveChangesAsync(cancellationToken);
            return (ToMeta(row, photoMeta), null);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (ToMeta(row), null);
    }

    private static bool IsEvidencePhotoScope(string scope) =>
        scope is "field-inspection-photo"
            or "key-envelope-photo"
            or "government-keys-proof";

    public async Task<FileAttachmentMetaDto?> GetMetaAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;

        var photo = await _db.PhotoMetadata.AsNoTracking()
            .FirstOrDefaultAsync(p => p.PhotoId == id, cancellationToken);
        return ToMeta(row, photo);
    }

    public async Task<(FileAttachmentMetaDto? Meta, string? Error)> ClassifyAsync(
        Guid id,
        ClassifyAttachmentRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return (null, null);

        var typeKey = (request.DictionaryTypeKey ?? "").Trim().ToLowerInvariant();
        if (typeKey.Length > 64)
            return (null, "نوع المرفق غير صالح");

        // Library ≠ report: print requires a type; clearing type clears print.
        if (string.IsNullOrWhiteSpace(typeKey))
        {
            row.DictionaryTypeKey = "";
            row.PrintInReport = false;
        }
        else
        {
            // 11ف — the key must exist and be active in the admin dictionary; a typo
            // must not produce a "printable" attachment that can never route.
            if (_printDictionary is not null)
            {
                var dictionary = await _printDictionary.GetAsync(cancellationToken);
                var known = dictionary.Types.Any(t =>
                    t.IsActive && string.Equals(t.Key, typeKey, StringComparison.OrdinalIgnoreCase));
                if (!known)
                    return (null, "نوع المرفق غير معرف في قاموس المرفقات (11ف)");
            }

            row.DictionaryTypeKey = typeKey;
            row.PrintInReport = AttachmentPrintRules.IsPrintable(
                typeKey,
                request.PrintInReport == true);
        }

        await _db.SaveChangesAsync(cancellationToken);

        var photo = await _db.PhotoMetadata.AsNoTracking()
            .FirstOrDefaultAsync(p => p.PhotoId == id, cancellationToken);
        return (ToMeta(row, photo), null);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return false;

        if (!string.IsNullOrWhiteSpace(row.StorageKey))
            await _blobs.DeleteAsync(row.StorageKey, cancellationToken);

        var photo = await _db.PhotoMetadata.FirstOrDefaultAsync(x => x.PhotoId == id, cancellationToken);
        if (photo is not null) _db.PhotoMetadata.Remove(photo);

        _db.FileAttachments.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<byte[]?> ReadContentAsync(FileAttachment row, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(row.StorageKey))
            return await _blobs.ReadAsync(row.StorageKey, ct);

        return row.Content;
    }

    private static FileAttachmentMetaDto ToMeta(
        FileAttachment row,
        PhotoMetadata? photo = null,
        string? contentTypeOverride = null) => new()
    {
        Id = row.Id,
        Scope = row.Scope,
        ScopeKey = row.ScopeKey,
        FileName = row.FileName,
        ContentType = contentTypeOverride ?? row.ContentType,
        SizeBytes = row.SizeBytes > 0 ? row.SizeBytes : row.Content?.LongLength ?? 0,
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
}
