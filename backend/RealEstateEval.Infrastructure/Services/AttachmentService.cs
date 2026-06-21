using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class AttachmentService : IAttachmentService
{
    private const string BlobContainer = "attachments";
    private readonly ApplicationDbContext _db;
    private readonly IBlobStorage _blobs;

    public AttachmentService(ApplicationDbContext db, IBlobStorage blobs)
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
            .ToListAsync(cancellationToken);
        return rows.Select(ToMeta).ToList();
    }

    public async Task<(byte[]? Content, FileAttachmentMetaDto? Meta)> GetContentAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return (null, null);

        var content = await ReadContentAsync(row, cancellationToken);
        return content is null ? (null, null) : (content, ToMeta(row));
    }

    public async Task<FileAttachmentMetaDto> UploadAsync(
        UploadAttachmentRequest request,
        string uploadedByUserId,
        CancellationToken cancellationToken = default)
    {
        var content = Convert.FromBase64String(request.ContentBase64);

        var id = Guid.NewGuid();
        var safeName = Path.GetFileName(request.FileName.Trim());
        if (string.IsNullOrWhiteSpace(safeName))
            safeName = "file";

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
            ContentType = string.IsNullOrWhiteSpace(request.ContentType)
                ? "application/octet-stream"
                : request.ContentType.Trim(),
            StorageKey = storageKey,
            Content = null,
            SizeBytes = content.LongLength,
            UploadedByUserId = uploadedByUserId,
            CreatedAtUtc = DateTime.UtcNow,
        };
        _db.FileAttachments.Add(row);
        await _db.SaveChangesAsync(cancellationToken);
        return ToMeta(row);
    }

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

    private static FileAttachmentMetaDto ToMeta(FileAttachment row) => new()
    {
        Id = row.Id,
        Scope = row.Scope,
        ScopeKey = row.ScopeKey,
        FileName = row.FileName,
        ContentType = row.ContentType,
        SizeBytes = row.SizeBytes > 0 ? row.SizeBytes : row.Content?.LongLength ?? 0,
        CreatedAtUtc = row.CreatedAtUtc,
    };
}
