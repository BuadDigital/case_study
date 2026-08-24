namespace RealEstateEval.Domain;

public class FileAttachment
{
    public Guid Id { get; set; }
    public string Scope { get; set; } = "";
    public string ScopeKey { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    /// <summary>Blob key when stored on disk/S3; preferred over inline <see cref="Content"/>.</summary>
    public string? StorageKey { get; set; }
    public byte[]? Content { get; set; }
    public long SizeBytes { get; set; }
    public string UploadedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
