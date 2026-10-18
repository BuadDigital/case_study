using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Inspection photos travel between tasks through the attachments service's scope copy: every
/// file under «{fromTask}:…» is copied to «{toTask}:…» with the same suffix, so the photo
/// references of the copied payload stay valid for the destination task.
/// </summary>
public sealed class InspectionPhotoCopier(IAttachmentScopeCopier copier) : IInspectionPhotoCopier
{
    public async Task<IReadOnlyDictionary<Guid, Guid>> CopyInspectionPhotosAsync(
        Guid fromTaskId,
        Guid toTaskId,
        CancellationToken cancellationToken = default)
    {
        if (fromTaskId == toTaskId) return new Dictionary<Guid, Guid>();
        var copied = await copier.CopyScopeAsync(
            new CopyAttachmentScopeRequest
            {
                Scope = FieldInspectionScopes.Photo,
                FromScopeKeyPrefix = $"{fromTaskId:D}:",
                ToScopeKeyPrefix = $"{toTaskId:D}:",
            },
            cancellationToken);
        return copied
            .GroupBy(c => c.FromId)
            .ToDictionary(g => g.Key, g => g.First().ToId);
    }
}
