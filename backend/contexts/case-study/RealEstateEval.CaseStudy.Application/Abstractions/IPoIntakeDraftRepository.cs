using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for per-user PO intake wizard drafts.
/// </summary>
public interface IPoIntakeDraftRepository
{
    Task<PoIntakeDraft?> GetByUserIdAsync(
        string userId,
        bool track,
        CancellationToken cancellationToken);

    void Add(PoIntakeDraft draft);

    Task DeleteByUserIdAsync(string userId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
