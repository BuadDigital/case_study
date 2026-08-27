using RealEstateEval.Application.Contracts;
using RealEstateEval.Attachments.Application.Contracts;

namespace RealEstateEval.Attachments.Application.Abstractions;

/// <summary>
/// Cross-service attachment reads. The Attachments host uses the local store;
/// other hosts call the Attachments API.
/// </summary>
public interface IAttachmentLookup
{
    /// <param name="actor">
    /// Caller permissions for uploader / capability checks on HTTP-facing paths.
    /// Pass <see langword="null"/> only for trusted in-process gates that apply their
    /// own scope rules afterward (e.g. issuance checks, inspection attachment verifier).
    /// Never pass <see langword="null"/> from user-facing controllers.
    /// </param>
    Task<bool> ExistsAsync(
        Guid id,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <inheritdoc cref="ExistsAsync(Guid, PermissionsDto?, CancellationToken)"/>
    Task<IReadOnlyList<AttachmentRefDto>> GetRefsAsync(
        IReadOnlyList<Guid> ids,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    /// <inheritdoc cref="ExistsAsync(Guid, PermissionsDto?, CancellationToken)"/>
    Task<IReadOnlyList<FileAttachmentMetaDto>> ListForPropertyAsync(
        string propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);
}
