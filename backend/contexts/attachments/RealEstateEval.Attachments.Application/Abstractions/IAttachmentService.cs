using RealEstateEval.Application.Contracts;
using RealEstateEval.Attachments.Application.Contracts;

namespace RealEstateEval.Attachments.Application.Abstractions;

public interface IAttachmentService
{
    Task<IReadOnlyList<FileAttachmentMetaDto>> ListAsync(
        string scope,
        string scopeKey,
        CancellationToken cancellationToken = default);

    Task<(byte[]? Content, FileAttachmentMetaDto? Meta)> GetContentAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<(FileAttachmentMetaDto? Meta, string? Error)> UploadAsync(
        UploadAttachmentRequest request,
        string uploadedByUserId,
        CancellationToken cancellationToken = default);

    Task<FileAttachmentMetaDto?> GetMetaAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
