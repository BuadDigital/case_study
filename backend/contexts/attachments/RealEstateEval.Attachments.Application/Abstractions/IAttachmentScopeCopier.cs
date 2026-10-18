using RealEstateEval.Attachments.Application.Contracts;

namespace RealEstateEval.Attachments.Application.Abstractions;

/// <summary>
/// Server-side copy of every attachment under one scope-key prefix to another (the grouped
/// property's inspection photos travel from the sibling deed's inspection task to the new
/// deed's task). The Attachments host does it on its own store; other hosts call its internal
/// API — the route is reachable only through owner-to-owner dispatch, never from a browser,
/// because the copy deliberately bypasses the per-upload read rule: the calling service has
/// already decided the copy is legitimate.
/// </summary>
public interface IAttachmentScopeCopier
{
    Task<IReadOnlyList<CopiedAttachmentDto>> CopyScopeAsync(
        CopyAttachmentScopeRequest request,
        CancellationToken cancellationToken = default);
}
