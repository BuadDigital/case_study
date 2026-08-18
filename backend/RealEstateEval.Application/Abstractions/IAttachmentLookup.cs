using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Cross-service attachment reads. The Attachments host uses the local store;
/// other hosts call the Attachments API.
/// </summary>
public interface IAttachmentLookup
{
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default);
}
