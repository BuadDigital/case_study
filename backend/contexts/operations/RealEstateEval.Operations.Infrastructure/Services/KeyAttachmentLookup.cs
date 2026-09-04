using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Infrastructure.Services;

/// <summary>
/// Bridges the Operations port to the Attachments-owned lookup (EF on Attachments, HTTP
/// elsewhere). Keeps <c>Operations.Application</c> free of Attachments contracts.
/// </summary>
public sealed class KeyAttachmentLookup : IKeyAttachmentLookup
{
    private readonly IAttachmentLookup _inner;

    public KeyAttachmentLookup(IAttachmentLookup inner) => _inner = inner;

    public Task<bool> ExistsAsync(Guid attachmentId, CancellationToken cancellationToken = default) =>
        _inner.ExistsAsync(attachmentId, actor: null, cancellationToken);
}
