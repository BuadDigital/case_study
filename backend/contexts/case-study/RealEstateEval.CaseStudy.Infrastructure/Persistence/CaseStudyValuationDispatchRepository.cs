using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class CaseStudyValuationDispatchRepository(CaseStudyDbContext db)
    : ICaseStudyValuationDispatchRepository
{
    public Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);

    public Task<bool> HasAppraisalChildAsync(Guid parentTaskId, CancellationToken cancellationToken) =>
        db.WorkflowTasks.AsNoTracking()
            .AnyAsync(
                t => t.ParentTaskId == parentTaskId
                     && t.Kind == WorkflowTaskKind.PropertyAppraisal,
                cancellationToken);

    public Task<WorkflowTask?> GetLatestAppraisalChildAsync(
        Guid parentTaskId,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks.AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId
                        && t.Kind == WorkflowTaskKind.PropertyAppraisal)
            .OrderByDescending(t => t.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<WorkOrderProperty?> GetPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkOrderProperties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    /// <summary>The holder deed of the property's transaction and the other live deeds in it.</summary>
    /// <remarks>
    /// How it works: StudyHolder.HolderPropertyAsync gives the holder; StudyHolder.TransactionPropertyIdsAsync
    /// gives the live deeds; the property itself is removed from that list.
    /// Edge cases: a deed alone (or with TransactionId = Guid.Empty) returns (itself, []), so the
    /// dispatch's fold step is a no-op for an ordinary property.
    /// </remarks>
    public async Task<(Guid HolderPropertyId, IReadOnlyList<Guid> SiblingPropertyIds)> GetTransactionDeedsAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var holder = await StudyHolder.HolderPropertyAsync(db, propertyId, cancellationToken);
        var deeds = await StudyHolder.TransactionPropertyIdsAsync(db, propertyId, cancellationToken);
        return (holder, deeds.Where(id => id != propertyId).ToList());
    }

    public Task<PartyTaskSubmission?> GetSubmissionAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken) =>
        db.PartyTaskSubmissions
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == workflowTaskId, cancellationToken);

    public void AddSubmission(PartyTaskSubmission submission) =>
        db.PartyTaskSubmissions.Add(submission);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
