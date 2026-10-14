using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Attachments.Application.Contracts;

public class FileAttachmentMetaDto
{
    public Guid Id { get; init; }
    public required string Scope { get; init; }
    public required string ScopeKey { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public long SizeBytes { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public PhotoMetadataDto? PhotoMetadata { get; init; }
    /// <summary>Registry key (<c>PropertyDocumentTypes</c>) — null for non-property uploads.</summary>
    public string? DocumentTypeKey { get; init; }
    public string? CustomDocumentLabel { get; init; }
    public string? CustomDocumentReason { get; init; }
    /// <summary><c>ValueDocumentStatuses</c> — set only on a «مستند ذو قيمة».</summary>
    public string? ValueDocStatus { get; init; }
    public string? ValueDocReviewNote { get; init; }
    public DateTime? ValueDocReviewedAtUtc { get; init; }
}

/// <summary>
/// What the uploader of a «مستند ذو قيمة» sees of it: its name, file type and the specialist's decision
/// (they open the file through the normal attachment download, which allows its own uploader).
/// </summary>
public sealed class OwnValuedDocumentDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    /// <summary><c>ValueDocumentStatuses</c>: pending | approved | rejected.</summary>
    public required string Status { get; init; }
    public string? ReviewNote { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}

public sealed class AttachmentRefDto
{
    public Guid Id { get; init; }
    public required string Scope { get; init; }
    public required string ScopeKey { get; init; }
}

public sealed class AttachmentExistsDto
{
    public bool Exists { get; init; }
}

public class UploadAttachmentRequest
{
    [Required, MaxLength(64)]
    public string Scope { get; init; } = "";
    [Required, MaxLength(512)]
    public string ScopeKey { get; init; } = "";
    [Required, MaxLength(512)]
    public string FileName { get; init; } = "";
    [MaxLength(128)]
    public string ContentType { get; init; } = "application/octet-stream";
    [Required]
    public string ContentBase64 { get; init; } = "";

 /// <summary>Optional EXIF extracted on-device before compression.</summary>
    public PhotoMetadataInput? PhotoMetadata { get; init; }

 /// <summary>Registry type — required on the governed <c>property-document</c> scope.</summary>
    [MaxLength(64)]
    public string? DocumentTypeKey { get; init; }
 /// <summary>Name of a document outside the defined list.</summary>
    [MaxLength(128)]
    public string? CustomDocumentLabel { get; init; }
 /// <summary>Why a document outside the defined list is needed.</summary>
    [MaxLength(512)]
    public string? CustomDocumentReason { get; init; }
}

/// <summary>Classify a documents-tab upload onto a registry type, or mark it as unlisted.</summary>
public sealed class SetAttachmentDocumentTypeRequest
{
    [Required, MaxLength(64)]
    public string DocumentTypeKey { get; init; } = "";
    [MaxLength(128)]
    public string? CustomDocumentLabel { get; init; }
    [MaxLength(512)]
    public string? CustomDocumentReason { get; init; }
}

/// <summary>The case specialist approves or rejects a «مستند ذو قيمة».</summary>
public sealed class ReviewValueDocumentRequest
{
    [Required, MaxLength(16)]
    public string Decision { get; init; } = "";
    [MaxLength(512)]
    public string? Note { get; init; }
}

public class PhotoMetadataInput
{
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public DateTime? CapturedAtUtc { get; init; }
 /// <summary>Property GPS at capture time — used to stamp distance/flag.</summary>
    public double? PropertyLatitude { get; init; }
    public double? PropertyLongitude { get; init; }
}

public class PhotoMetadataDto
{
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public DateTime? CapturedAtUtc { get; init; }
    public double? DistanceM { get; init; }
    public string? Flag { get; init; }
}
