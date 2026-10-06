using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class CaseStudyReportRepository(CaseStudyDbContext db) : ICaseStudyReportRepository
{
    public Task<CaseStudyReport?> GetFormAsync(
        Guid taskId,
        bool party,
        bool track,
        CancellationToken cancellationToken)
    {
        var query = track ? db.CaseStudyReports.AsQueryable() : db.CaseStudyReports.AsNoTracking();
        return query.FirstOrDefaultAsync(
            f => f.TaskId == taskId && f.IsPartyContribution == party,
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

    public Task<bool> CaseStudyReportHasStatusAsync(
        Guid taskId,
        string status,
        CancellationToken cancellationToken) =>
        db.CaseStudyReports
            .AsNoTracking()
            .AnyAsync(
                f => f.TaskId == taskId && !f.IsPartyContribution && f.Status == status,
                cancellationToken);

    public async Task<IReadOnlyList<Guid>> ListChildTaskIdsAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<CaseStudyReport>> ListPartyContributionsForUpdateAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken) =>
        await db.CaseStudyReports
            .Where(f => f.IsPartyContribution && taskIds.Contains(f.TaskId))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<WorkflowTask>> ListChildTasksAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId)
            .ToListAsync(cancellationToken);

    public Task<bool> HasSubmittedAppraisalPackageAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        (from task in db.WorkflowTasks.AsNoTracking()
         join submission in db.PartyTaskSubmissions.AsNoTracking()
             on task.Id equals submission.WorkflowTaskId
         where task.ParentTaskId == parentTaskId
               && task.Kind == WorkflowTaskKind.PropertyAppraisal
               && task.Status != WorkflowTaskStatus.Cancelled
               && submission.Status == PartyTaskSubmissionStatus.Submitted
         select submission.Id)
        .AnyAsync(cancellationToken);

    public Task<WorkOrderProperty?> GetPropertyForUpdateAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties.FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public async Task<DeedKind?> GetPropertyDeedKindAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var kind = await db.WorkOrderProperties
            .AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => (DeedKind?)p.DeedKind)
            .FirstOrDefaultAsync(cancellationToken);
        return kind;
    }

    public void AddForm(CaseStudyReport form) => db.CaseStudyReports.Add(form);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        EfConcurrency.SaveAsync(db, cancellationToken);

    public void DiscardTrackedChanges() => db.ChangeTracker.Clear();

    public Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);

    public Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);
}
