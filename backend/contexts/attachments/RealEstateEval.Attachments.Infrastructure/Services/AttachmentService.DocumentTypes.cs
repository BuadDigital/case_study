using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Attachments.Application.Rules;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Attachments.Infrastructure.Services;

/// <summary>Document governance on stored uploads: re-typing documents-tab uploads.</summary>
public sealed partial class AttachmentService
{
    public async Task<(FileAttachmentMetaDto? Meta, string? Error)> SetDocumentTypeAsync(
        Guid id,
        SetAttachmentDocumentTypeRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.FileAttachments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null || !CanAccess(row, actor)) return (null, null);

        var resolved = PropertyDocumentUploadRules.Reclassify(
            row.Scope,
            request.DocumentTypeKey,
            request.CustomDocumentLabel,
            request.CustomDocumentReason);
        if (resolved.Error is not null) return (null, resolved.Error);

        ApplyDocumentType(row, resolved);
        await _db.SaveChangesAsync(cancellationToken);
        return (await MetaWithPhotoAsync(row, cancellationToken), null);
    }

    private static void ApplyDocumentType(FileAttachment row, ResolvedDocumentType resolved)
    {
        row.DocumentTypeKey = resolved.TypeKey;
        row.CustomDocumentLabel = resolved.CustomLabel;
        row.CustomDocumentReason = resolved.CustomReason;
    }

    private async Task<FileAttachmentMetaDto> MetaWithPhotoAsync(FileAttachment row, CancellationToken ct)
    {
        var photo = await _db.PhotoMetadata.AsNoTracking()
            .FirstOrDefaultAsync(p => p.PhotoId == row.Id, ct);
        return AttachmentMetaMapper.ToMeta(row, photo);
    }
}
