namespace RealEstateEval.Attachments.Application.Abstractions;

/// <summary>
/// Cross-service attachment writes for system-generated files (a report's deposit certificate, its final PDF).
/// The Attachments host owns the bytes; other hosts call the Attachments API with the caller's bearer, so the
/// same scope, content and access rules apply as for any upload.
/// </summary>
public interface IAttachmentFileStore
{
    /// <returns>The new attachment id, or an Arabic refusal (content rejected or the store is unreachable).</returns>
    Task<(Guid? Id, string? Error)> StoreAsync(
        string scope,
        string scopeKey,
        string fileName,
        string contentType,
        byte[] content,
        CancellationToken cancellationToken = default);

    /// <summary>The stored bytes; null when the attachment does not exist or the caller may not read it.</summary>
    Task<byte[]?> ReadAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Best effort: removes an attachment that was replaced. Never throws for an absent file.</summary>
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
