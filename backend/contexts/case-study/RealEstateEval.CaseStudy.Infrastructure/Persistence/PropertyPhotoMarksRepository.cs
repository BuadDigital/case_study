using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class PropertyPhotoMarksRepository(CaseStudyDbContext db) : IPropertyPhotoMarksRepository
{
    public Task<WorkOrderProperty?> GetPropertyAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var po = IWorkOrderLoader.NormalizePo(poNumber);
        return db.WorkOrderProperties.FirstOrDefaultAsync(
            p => p.Id == propertyId && p.WorkOrder!.PoNumber == po,
            cancellationToken);
    }

    public async Task<bool> IsStudyReportIssuedAsync(Guid propertyId, CancellationToken cancellationToken)
    {
        // Linked deeds share one study: its report sits on the holder deed.
        var studyPropertyId = await StudyHolder.HolderPropertyAsync(db, propertyId, cancellationToken);
        var status = await db.CaseStudyReports.AsNoTracking()
            .Where(f => f.PropertyId == studyPropertyId && !f.IsPartyContribution)
            .OrderByDescending(f => f.UpdatedAtUtc)
            .Select(f => f.Status)
            .FirstOrDefaultAsync(cancellationToken);
        return status == CaseStudyReportStatuses.Issued;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
