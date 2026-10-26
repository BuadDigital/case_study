using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class ValuationReportWorkflowTaskLookup(CaseStudyDbContext db)
    : IValuationReportWorkflowTaskLookup
{
    public async Task<OpenAppraisalTaskRef?> FindOpenAppraisalTaskAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var task = await db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.PropertyAppraisal)
            .Where(t => t.PropertyId == propertyId)
            .Where(t => t.Status != WorkflowTaskStatus.Completed && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.UpdatedAtUtc)
            .Select(t => new { t.Id, t.PoNumber })
            .FirstOrDefaultAsync(cancellationToken);
        if (task is null)
            return null;

        var submitted = await db.PartyTaskSubmissions.AsNoTracking()
            .AnyAsync(
                s => s.WorkflowTaskId == task.Id && s.Status == PartyTaskSubmissionStatus.Submitted,
                cancellationToken);
        return new OpenAppraisalTaskRef(task.Id, task.PoNumber, submitted);
    }

    /// <summary>The other live deeds of the property's transaction (phase 5).</summary>
    /// <remarks>
    /// How it works: StudyHolder.TransactionPropertyIdsAsync, minus the property itself.
    /// Edge cases: an ordinary deed (or one with TransactionId = Guid.Empty) yields an empty list, so
    /// the final issuance closes only its own appraisal task.
    /// </remarks>
    public async Task<IReadOnlyList<Guid>> ListSiblingDeedIdsAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var ids = await StudyHolder.TransactionPropertyIdsAsync(db, propertyId, cancellationToken);
        return ids.Where(id => id != propertyId).ToList();
    }
}
