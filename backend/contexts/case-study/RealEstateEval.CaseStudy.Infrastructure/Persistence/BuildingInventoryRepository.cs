using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class BuildingInventoryRepository(CaseStudyDbContext db) : IBuildingInventoryRepository
{
    public Task<WorkOrderProperty?> GetPropertyWithLinesAsync(
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
            .Include(p => p.BuildingInventoryLines)
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrder!.PoNumber == po,
                cancellationToken);
    }

    public Task<WorkOrderProperty> GetSavedPropertyWithLinesAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.BuildingInventoryLines)
            .FirstAsync(p => p.Id == propertyId, cancellationToken);

    public void AddLine(BuildingInventoryLine line) => db.BuildingInventoryLines.Add(line);

    public void RemoveLines(IReadOnlyCollection<BuildingInventoryLine> lines) =>
        db.BuildingInventoryLines.RemoveRange(lines);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
