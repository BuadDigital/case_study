using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Financial.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Bridges the Financial port to the Attachments-owned lookup (EF on Attachments, HTTP
/// elsewhere). Keeps <c>Financial.Application</c> free of Attachments contracts.
/// </summary>
public sealed class StatementAttachmentLookup : IStatementAttachmentLookup
{
    private readonly IAttachmentLookup _inner;

    public StatementAttachmentLookup(IAttachmentLookup inner) => _inner = inner;

    public Task<bool> ExistsAsync(Guid attachmentId, CancellationToken cancellationToken = default) =>
        _inner.ExistsAsync(attachmentId, actor: null, cancellationToken);
}
