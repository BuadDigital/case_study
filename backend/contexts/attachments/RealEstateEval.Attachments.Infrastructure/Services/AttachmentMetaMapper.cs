using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Attachments.Infrastructure.Services;

/// <summary>One projection of an attachment row for every read path (service and lookup).</summary>
internal static class AttachmentMetaMapper
{
    public static FileAttachmentMetaDto ToMeta(
        FileAttachment row,
        PhotoMetadata? photo = null,
        string? contentTypeOverride = null) => new()
    {
        Id = row.Id,
        Scope = row.Scope,
        ScopeKey = row.ScopeKey,
        FileName = row.FileName,
        ContentType = contentTypeOverride ?? row.ContentType,
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
        DocumentTypeKey = row.DocumentTypeKey,
        CustomDocumentLabel = row.CustomDocumentLabel,
        CustomDocumentReason = row.CustomDocumentReason,
        ReviewStatus = row.ReviewStatus,
        ReviewNote = row.ReviewNote,
        ReviewedAtUtc = row.ReviewedAtUtc,
    };
}
