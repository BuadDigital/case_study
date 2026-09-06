namespace RealEstateEval.Attachments.Domain;

public class FileAttachment
{
    public Guid Id { get; set; }
    public string Scope { get; set; } = "";
    public string ScopeKey { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    /// <summary>Key of the file in blob storage; every attachment has one since the inline column was dropped.</summary>
    public string? StorageKey { get; set; }
    public long SizeBytes { get; set; }
    public string UploadedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
