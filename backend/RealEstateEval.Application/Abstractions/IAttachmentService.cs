using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IAttachmentService
{
    Task<IReadOnlyList<FileAttachmentMetaDto>> ListAsync(
        string scope,
        string scopeKey,
        CancellationToken cancellationToken = default);

    Task<(byte[]? Content, FileAttachmentMetaDto? Meta)> GetContentAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<FileAttachmentMetaDto> UploadAsync(
        UploadAttachmentRequest request,
        string uploadedByUserId,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
