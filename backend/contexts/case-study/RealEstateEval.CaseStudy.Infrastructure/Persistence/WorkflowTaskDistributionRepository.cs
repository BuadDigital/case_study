using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkflowTaskDistributionRepository(CaseStudyDbContext db)
    : IWorkflowTaskDistributionRepository
{
    public Task<WorkflowTask?> GetTaskForUpdateAsync(
        Guid taskId,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

    public Task<List<WorkflowTask>> ListChildrenForUpdateAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .Where(t => t.ParentTaskId == parentTaskId)
            .ToListAsync(cancellationToken);

    public Task<WorkOrderProperty?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public void AddTasks(IReadOnlyCollection<WorkflowTask> tasks) => db.WorkflowTasks.AddRange(tasks);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
