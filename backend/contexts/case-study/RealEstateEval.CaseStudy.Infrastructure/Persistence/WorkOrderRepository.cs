using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkOrderRepository(CaseStudyDbContext db) : IWorkOrderRepository
{
    public Task<(string? Reference, string? Error)> AllocateTransactionReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            db,
            DatabaseSchemas.CaseStudy,
            ReferenceNumbering.Transaction,
            nowUtc,
            cancellationToken);

    public void AddWorkOrder(WorkOrder workOrder) => db.WorkOrders.Add(workOrder);

    public Task<bool> HasActiveClientAsync(Guid clientId, CancellationToken cancellationToken) =>
        db.Clients.AsNoTracking()
            .AnyAsync(c => c.Id == clientId && c.IsActive, cancellationToken);

    public async Task DeleteWorkOrderCascadeAsync(
        WorkOrder workOrder,
        string normalizedPoNumber,
        CancellationToken cancellationToken)
    {
        var n = normalizedPoNumber;
        var tasks = await db.WorkflowTasks
            .Where(t => t.PoNumber == n)
            .ToListAsync(cancellationToken);
        if (tasks.Count > 0)
        {
            var taskIds = tasks.Select(t => t.Id).ToList();
            var forms = await db.CaseStudyForms
                .Where(f => f.PoNumber == n || taskIds.Contains(f.TaskId))
                .ToListAsync(cancellationToken);
            if (forms.Count > 0)
                db.CaseStudyForms.RemoveRange(forms);
            var partySubs = await db.PartyTaskSubmissions
                .Where(s => s.PoNumber == n || taskIds.Contains(s.WorkflowTaskId))
                .ToListAsync(cancellationToken);
            if (partySubs.Count > 0)
            {
                var inspectionTaskIds = partySubs
                    .Where(s => s.Kind == WorkflowTaskKindValues.FieldInspection)
                    .Select(s => s.WorkflowTaskId)
                    .ToList();
                if (inspectionTaskIds.Count > 0)
                {
                    var workspaces = await db.FieldInspectionWorkspaces
                        .Where(w => inspectionTaskIds.Contains(w.WorkflowTaskId))
                        .ToListAsync(cancellationToken);
                    if (workspaces.Count > 0)
                        db.FieldInspectionWorkspaces.RemoveRange(workspaces);
                }

                db.PartyTaskSubmissions.RemoveRange(partySubs);
            }
            db.WorkflowTasks.RemoveRange(tasks);
        }
        else
        {
            var forms = await db.CaseStudyForms
                .Where(f => f.PoNumber == n)
                .ToListAsync(cancellationToken);
            if (forms.Count > 0)
                db.CaseStudyForms.RemoveRange(forms);
        }

        db.WorkOrders.Remove(workOrder);
        await db.PropertyTimelineEntries
            .Where(e => e.PoNumber == n)
            .ExecuteDeleteAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
