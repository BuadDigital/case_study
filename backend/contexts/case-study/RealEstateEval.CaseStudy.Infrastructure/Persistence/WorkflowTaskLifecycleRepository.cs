using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkflowTaskLifecycleRepository(CaseStudyDbContext db)
    : IWorkflowTaskLifecycleRepository
{
    public Task<WorkflowTask?> GetTaskForUpdateAsync(
        Guid taskId,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

    public Task<WorkOrderProperty?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public Task<WorkOrderProperty?> GetPropertyForUpdateAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public Task<List<WorkflowTask>> ListChildrenForUpdateAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .Where(t => t.ParentTaskId == parentTaskId)
            .ToListAsync(cancellationToken);

    public Task<List<WorkflowTask>> ListTasksForPoForUpdateAsync(
        string poNumber,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .Where(t => t.PoNumber == poNumber)
            .ToListAsync(cancellationToken);

    public Task<WorkOrder?> GetWorkOrderWithPropertiesForUpdateAsync(
        string poNumber,
        CancellationToken cancellationToken) =>
        db.WorkOrders
            .Include(o => o.Properties)
            .FirstOrDefaultAsync(o => o.PoNumber == poNumber, cancellationToken);

    public async Task<IReadOnlyList<PartyTaskSubmission>> ListSubmissionsForUpdateAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken) =>
        await db.PartyTaskSubmissions
            .Where(s => taskIds.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);

    public void RemoveTasks(IReadOnlyCollection<WorkflowTask> tasks) =>
        db.WorkflowTasks.RemoveRange(tasks);

    public void RemoveSubmissions(IReadOnlyCollection<PartyTaskSubmission> submissions) =>
        db.PartyTaskSubmissions.RemoveRange(submissions);

    public Task DeleteFieldInspectionWorkspacesAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken) =>
        db.FieldInspectionWorkspaces
            .Where(w => taskIds.Contains(w.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);

    public Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);
}
