namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Existence check for the files a key envelope quotes — the envelope photo, the court receipt
/// letter, the third-party letter, the handoff proof, and the court-access letters. Attachments
/// are owned by another context, so Operations states the one question it asks here and the
/// Infrastructure adapter bridges to <c>IAttachmentLookup</c>.
/// </summary>
public interface IKeyAttachmentLookup
{
    Task<bool> ExistsAsync(Guid attachmentId, CancellationToken cancellationToken = default);
}
