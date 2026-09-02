using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IPartyTaskSubmissionRepository"/>. The only place the
/// party-submission use case touches <see cref="CaseStudyDbContext"/>.
/// </summary>
public sealed class PartyTaskSubmissionRepository(CaseStudyDbContext db) : IPartyTaskSubmissionRepository
{
    public Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

    public async Task<IReadOnlyList<PartyTaskFacts>> ListTaskFactsAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        if (taskIds.Count == 0) return [];
        var ids = taskIds.Distinct().ToList();
        return await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .Select(t => new PartyTaskFacts(
                t.Id,
                t.AssigneeId,
                t.Kind,
                t.Status,
                t.PropertyId,
                t.ParentTaskId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<WorkflowTask>> ListSiblingTasksAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (parentTaskIds.Count == 0 || propertyIds.Count == 0) return [];
        var parents = parentTaskIds.Distinct().ToList();
        var properties = propertyIds.Distinct().ToList();
        return await db.WorkflowTasks
            .AsNoTracking()
            .Where(t =>
                t.ParentTaskId != null
                && parents.Contains(t.ParentTaskId.Value)
                && t.PropertyId != null
                && properties.Contains(t.PropertyId.Value))
            .ToListAsync(cancellationToken);
    }

    public Task<PartyTaskSubmission?> GetSubmissionAsync(
        Guid taskId,
        bool track,
        CancellationToken cancellationToken)
    {
        var query = track ? db.PartyTaskSubmissions.AsQueryable() : db.PartyTaskSubmissions.AsNoTracking();
        return query.FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);
    }

    public async Task<IReadOnlyList<PartyTaskSubmission>> ListSubmissionsAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        if (taskIds.Count == 0) return [];
        var ids = taskIds.Distinct().ToList();
        return await db.PartyTaskSubmissions
            .AsNoTracking()
            .Where(s => ids.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlySet<Guid>> ListAcceptedSubmissionTaskIdsAsync(
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        if (taskIds.Count == 0) return new HashSet<Guid>();
        var ids = taskIds.Distinct().ToList();
        var accepted = await db.PartyTaskSubmissions
            .AsNoTracking()
            .Where(s => ids.Contains(s.WorkflowTaskId) && s.AcceptedAtUtc != null)
            .Select(s => s.WorkflowTaskId)
            .ToListAsync(cancellationToken);
        return accepted.ToHashSet();
    }

    public Task<WorkOrderProperty?> GetPropertyWithContactsAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.Contacts)
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public void Add(PartyTaskSubmission submission) => db.PartyTaskSubmissions.Add(submission);

    public async Task UpsertFieldInspectionWorkspaceAsync(
        FieldInspectionWorkspace projected,
        CancellationToken cancellationToken)
    {
        var existing = await db.FieldInspectionWorkspaces
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == projected.WorkflowTaskId, cancellationToken);

        if (existing is null)
        {
            db.FieldInspectionWorkspaces.Add(projected);
            return;
        }

        var createdAtUtc = existing.CreatedAtUtc;
        db.Entry(existing).CurrentValues.SetValues(projected);
        existing.CreatedAtUtc = createdAtUtc;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);

    public Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);

    public Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<(bool Commit, T Result)>> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);
}
