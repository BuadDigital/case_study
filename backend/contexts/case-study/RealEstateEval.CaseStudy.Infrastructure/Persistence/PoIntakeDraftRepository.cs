using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class PoIntakeDraftRepository(CaseStudyDbContext db) : IPoIntakeDraftRepository
{
    public Task<PoIntakeDraft?> GetByUserIdAsync(
        string userId,
        bool track,
        CancellationToken cancellationToken)
    {
        var query = track ? db.PoIntakeDrafts.AsQueryable() : db.PoIntakeDrafts.AsNoTracking();
        return query.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
    }

    public void Add(PoIntakeDraft draft) => db.PoIntakeDrafts.Add(draft);

    public Task DeleteByUserIdAsync(string userId, CancellationToken cancellationToken) =>
        db.PoIntakeDrafts.Where(x => x.UserId == userId).ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
