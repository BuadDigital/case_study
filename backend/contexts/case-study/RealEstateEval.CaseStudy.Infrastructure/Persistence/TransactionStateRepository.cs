using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class TransactionStateRepository(CaseStudyDbContext db) : ITransactionStateRepository
{
    public Task<WorkOrderProperty?> GetPropertyAsync(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrderId == workOrderId,
                cancellationToken);

    public async Task<IReadOnlyList<WorkflowTask>> ListPropertyTasksAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        await db.WorkflowTasks.AsNoTracking()
            .Where(t => t.PropertyId == propertyId)
            .ToListAsync(cancellationToken);

    public Task<bool> IsCaseStudyReportIssuedAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        db.CaseStudyReports.AsNoTracking()
            .AnyAsync(
                r => r.TaskId == parentTaskId
                    && !r.IsPartyContribution
                    && r.Status == CaseStudyReportStatuses.Issued,
                cancellationToken);

    public Task<bool> IsPartyPackageSubmittedAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken) =>
        db.PartyTaskSubmissions.AsNoTracking()
            .AnyAsync(
                s => s.WorkflowTaskId == workflowTaskId && s.Status == PartyTaskSubmissionStatus.Submitted,
                cancellationToken);

    public Task<string?> GetPoNumberAsync(Guid workOrderId, CancellationToken cancellationToken) =>
        db.WorkOrders.AsNoTracking()
            .Where(w => w.Id == workOrderId)
            .Select(w => w.PoNumber)
            .FirstOrDefaultAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
