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

    /// <summary>Registry key from <c>PropertyDocumentTypes</c>; null for non-property uploads.</summary>
    public string? DocumentTypeKey { get; set; }
    /// <summary>Name the uploader gave a document outside the defined list.</summary>
    public string? CustomDocumentLabel { get; set; }
    /// <summary>Why a document outside the defined list was needed.</summary>
    public string? CustomDocumentReason { get; set; }
    /// <summary><c>PropertyDocumentReviewStatuses</c>; set only for documents outside the defined list.</summary>
    public string? ReviewStatus { get; set; }
    public string? ReviewNote { get; set; }
    public string? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}
