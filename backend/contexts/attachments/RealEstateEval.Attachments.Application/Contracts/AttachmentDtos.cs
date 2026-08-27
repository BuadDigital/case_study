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
