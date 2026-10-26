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

    /// <summary>Whether the deed's study — its transaction's one study on the holder task — is issued.</summary>
    /// <remarks>
    /// How it works: StudyHolder.IssuedParentTaskIdsAsync for the one task id.
    /// Edge cases: a folded deed's own task never has a report row; it reads as issued once the
    /// holder's report is issued, so its gates open with the holder's.
    /// </remarks>
    public async Task<bool> IsCaseStudyReportIssuedAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        (await StudyHolder.IssuedParentTaskIdsAsync(db, [parentTaskId], cancellationToken)).Contains(parentTaskId);

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
