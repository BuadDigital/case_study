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

 /// <summary>Re-type a documents-tab upload. (null, null) = not found / not visible.</summary>
    Task<(FileAttachmentMetaDto? Meta, string? Error)> SetDocumentTypeAsync(
        Guid id,
        SetAttachmentDocumentTypeRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

 /// <summary>Approve / reject an unlisted document. (null, null) = not found / not visible.</summary>
    Task<(FileAttachmentMetaDto? Meta, string? Error)> ReviewDocumentAsync(
        Guid id,
        ReviewAttachmentDocumentRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
