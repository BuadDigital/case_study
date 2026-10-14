using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;
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

    public async Task<IReadOnlyList<FieldInspectionWriteFacts>> GetFieldInspectionWriteFactsAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var po = IWorkOrderLoader.NormalizePo(poNumber);
        var tasks = await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.FieldInspection
                && t.PoNumber == po
                && t.PropertyId == propertyId
                && t.Status != WorkflowTaskStatus.Cancelled)
            .Select(t => new { t.Id, t.AssigneeId })
            .ToListAsync(cancellationToken);
        if (tasks.Count == 0) return [];

        var taskIds = tasks.Select(t => t.Id).ToList();
        var statuses = await db.PartyTaskSubmissions
            .AsNoTracking()
            .Where(s => taskIds.Contains(s.WorkflowTaskId))
            .Select(s => new { s.WorkflowTaskId, s.Status })
            .ToDictionaryAsync(s => s.WorkflowTaskId, s => s.Status, cancellationToken);

        return tasks
            .Select(t => new FieldInspectionWriteFacts(
                t.AssigneeId,
                statuses.GetValueOrDefault(t.Id)))
            .ToList();
    }

    public void AddLine(BuildingInventoryLine line) => db.BuildingInventoryLines.Add(line);

    public void RemoveLines(IReadOnlyCollection<BuildingInventoryLine> lines) =>
        db.BuildingInventoryLines.RemoveRange(lines);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
