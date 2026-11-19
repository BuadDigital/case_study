using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>EF adapter of <see cref="IAppraiserHandoverRepository"/>.</summary>
public sealed class AppraiserHandoverRepository(CaseStudyDbContext db) : IAppraiserHandoverRepository
{
    private IQueryable<AppraiserHandoverRequest> Open =>
        db.AppraiserHandoverRequests.Where(r =>
            r.Status == AppraiserHandoverStatuses.Pending || r.Status == AppraiserHandoverStatuses.Taken);

    public Task<AppraiserHandoverRequest?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        db.AppraiserHandoverRequests.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public Task<AppraiserHandoverRequest?> FindOpenForTaskAsync(Guid appraisalTaskId, CancellationToken cancellationToken) =>
        Open.FirstOrDefaultAsync(r => r.AppraisalTaskId == appraisalTaskId, cancellationToken);

    public async Task<IReadOnlyList<AppraiserHandoverRequest>> ListOpenAsync(CancellationToken cancellationToken) =>
        await Open.OrderBy(r => r.RequestedAtUtc).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<AppraiserHandoverRequest>> ListOpenForAppraiserAsync(
        string assigneeId,
        CancellationToken cancellationToken) =>
        await Open.AsNoTracking()
            .Where(r => r.RequestedByAssigneeId == assigneeId || r.PeerAssigneeId == assigneeId)
            .OrderBy(r => r.RequestedAtUtc)
            .ToListAsync(cancellationToken);

    public Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken) =>
        db.WorkflowTasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

    public Task<PartyTaskSubmission?> GetSubmissionAsync(Guid taskId, CancellationToken cancellationToken) =>
        db.PartyTaskSubmissions.AsNoTracking().FirstOrDefaultAsync(s => s.WorkflowTaskId == taskId, cancellationToken);

    public Task<Transaction?> GetTransactionForPropertyAsync(Guid propertyId, CancellationToken cancellationToken) =>
        db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => p.Transaction)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task AddAsync(AppraiserHandoverRequest request, CancellationToken cancellationToken) =>
        await db.AppraiserHandoverRequests.AddAsync(request, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
