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

    public AttachmentService(AttachmentsDbContext db, IBlobStorage blobs)
    {
        _db = db;
        _blobs = blobs;
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
        return rows.Select(row => ToMeta(row)).ToList();
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
        return (content, ToMeta(row, FileSignatureInspector.CanonicalMime(format)));
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
            _db.PhotoMetadata.Add(new PhotoMetadata
            {
                Id = Guid.NewGuid(),
                PhotoId = id,
                Latitude = request.PhotoMetadata.Latitude,
                Longitude = request.PhotoMetadata.Longitude,
                CapturedAtUtc = request.PhotoMetadata.CapturedAtUtc,
                CreatedAtUtc = DateTime.UtcNow,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (ToMeta(row), null);
    }

    private static bool IsEvidencePhotoScope(string scope) =>
        scope is "field-inspection-photo"
            or "key-envelope-photo"
            or "government-keys-proof";

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return false;

        if (!string.IsNullOrWhiteSpace(row.StorageKey))
            await _blobs.DeleteAsync(row.StorageKey, cancellationToken);

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
        string? contentTypeOverride = null) => new()
    {
        Id = row.Id,
        Scope = row.Scope,
        ScopeKey = row.ScopeKey,
        FileName = row.FileName,
        ContentType = contentTypeOverride ?? row.ContentType,
        SizeBytes = row.SizeBytes > 0 ? row.SizeBytes : row.Content?.LongLength ?? 0,
        CreatedAtUtc = row.CreatedAtUtc,
    };
}
