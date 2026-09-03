using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class CaseStudyFormRepository(CaseStudyDbContext db) : ICaseStudyFormRepository
{
    public Task<CaseStudyForm?> GetFormAsync(
        Guid taskId,
        bool party,
        bool track,
        CancellationToken cancellationToken)
    {
        var query = track ? db.CaseStudyForms.AsQueryable() : db.CaseStudyForms.AsNoTracking();
        return query.FirstOrDefaultAsync(
            f => f.TaskId == taskId && f.IsPartyForm == party,
            cancellationToken);
    }

    public Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

    public async Task<IReadOnlyList<string?>> ListTaskAndChildAssigneeIdsAsync(
        Guid taskId,
        CancellationToken cancellationToken) =>
        await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.Id == taskId || t.ParentTaskId == taskId)
            .Select(t => t.AssigneeId)
            .ToListAsync(cancellationToken);

    public Task<bool> CaseStudyFormHasStatusAsync(
        Guid taskId,
        string status,
        CancellationToken cancellationToken) =>
        db.CaseStudyForms
            .AsNoTracking()
            .AnyAsync(
                f => f.TaskId == taskId && !f.IsPartyForm && f.Status == status,
                cancellationToken);

    public async Task<IReadOnlyList<Guid>> ListChildTaskIdsAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<CaseStudyForm>> ListPartyFormsForUpdateAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken) =>
        await db.CaseStudyForms
            .Where(f => f.IsPartyForm && taskIds.Contains(f.TaskId))
            .ToListAsync(cancellationToken);

    public void AddForm(CaseStudyForm form) => db.CaseStudyForms.Add(form);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        EfConcurrency.SaveAsync(db, cancellationToken);

    public void DiscardTrackedChanges() => db.ChangeTracker.Clear();
}
