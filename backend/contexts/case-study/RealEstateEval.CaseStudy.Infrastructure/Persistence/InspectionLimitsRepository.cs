using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class InspectionLimitsRepository(CaseStudyDbContext db) : IInspectionLimitsRepository
{
    public Task<WorkOrderProperty?> GetPropertyAsync(
        string poNumber,
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken)
    {
        var po = IWorkOrderLoader.NormalizePo(poNumber);
        var query = track
            ? db.WorkOrderProperties.AsQueryable()
            : db.WorkOrderProperties.AsNoTracking();
        return query
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrder!.PoNumber == po,
                cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
