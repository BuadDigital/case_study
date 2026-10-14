using RealEstateEval.Application.Contracts;
using RealEstateEval.Attachments.Application.Contracts;

namespace RealEstateEval.Attachments.Application.Abstractions;

public interface IAttachmentService
{
    /// <param name="actor">Hides «مستند ذو قيمة» rows from roles outside the specialist / appraiser.</param>
    Task<IReadOnlyList<FileAttachmentMetaDto>> ListAsync(
        string scope,
        string scopeKey,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <summary>The «مستندات ذات القيمة» of one property this actor may see: all of them for the specialist / appraiser / CDO, otherwise only their own uploads — name, type and decision.</summary>
    Task<IReadOnlyList<OwnValuedDocumentDto>> ListOwnValuedDocumentsAsync(
        string scopeKey,
        PermissionsDto? actor,
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

    /// <summary>Specialist approval of a «مستند ذو قيمة». (null, null) = not found / not visible.</summary>
    Task<(FileAttachmentMetaDto? Meta, string? Error)> ReviewValueDocumentAsync(
        Guid id,
        ReviewValueDocumentRequest request,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
