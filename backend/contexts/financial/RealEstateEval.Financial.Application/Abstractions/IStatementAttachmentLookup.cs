namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Existence check for the attachments a statement quotes — the vendor invoice PDF and the
/// transfer receipt. Attachments are owned by another context, so Financial states the one
/// question it asks here and the Infrastructure adapter bridges to <c>IAttachmentLookup</c>.
/// </summary>
public interface IStatementAttachmentLookup
{
    Task<bool> ExistsAsync(Guid attachmentId, CancellationToken cancellationToken = default);
}
