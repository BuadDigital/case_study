using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkOrderPropertyRepository(CaseStudyDbContext db) : IWorkOrderPropertyRepository
{
    public Task<(string? Number, string? Error)> AllocateDeedReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            db,
            DatabaseSchemas.CaseStudy,
            ReferenceNumbering.Property,
            nowUtc,
            cancellationToken);

    public void AddProperty(WorkOrderProperty property) => db.WorkOrderProperties.Add(property);

    public void DetachContacts(IEnumerable<PropertyContact> contacts)
    {
        foreach (var contact in contacts)
            db.Entry(contact).State = EntityState.Detached;
    }

    public async Task ReplaceContactsAsync(
        Guid propertyId,
        IReadOnlyCollection<PropertyContact> rows,
        CancellationToken cancellationToken)
    {
        await db.PropertyContacts
            .Where(c => c.PropertyId == propertyId)
            .ExecuteDeleteAsync(cancellationToken);

        foreach (var entry in db.ChangeTracker.Entries<PropertyContact>()
                     .Where(e => e.Entity.PropertyId == propertyId)
                     .ToList())
        {
            entry.State = EntityState.Detached;
        }

        if (rows.Count == 0) return;

        db.PropertyContacts.AddRange(rows);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<WorkOrderProperty> GetSavedPropertyWithContactsAsync(
        Guid propertyId,
        CancellationToken cancellationToken) =>
        // The transaction (with its deeds) rides along so the saved answer carries the property number,
        // link kind and deed count, like every other read of a deed; identity resolution because the
        // transaction → deeds → transaction include is a cycle a plain no-tracking query refuses.
        db.WorkOrderProperties
            .AsNoTrackingWithIdentityResolution()
            .Include(p => p.Contacts)
            .Include(p => p.Transaction)
            .ThenInclude(t => t!.Properties)
            .FirstAsync(p => p.Id == propertyId, cancellationToken);

    /// <summary>
    /// The deed's case-study task has passed the distribution (case study, obstruction or done).
    /// How it works: one EXISTS over the deed's case-study-property tasks. Edge cases: a deed with no
    /// task yet, or one still in Enfaz / bourse / distribution, is not distributed.
    /// </summary>
    public Task<bool> IsDistributedAsync(Guid propertyId, CancellationToken cancellationToken) =>
        db.WorkflowTasks.AsNoTracking().AnyAsync(
            t => t.PropertyId == propertyId
                && t.Kind == WorkflowTaskKind.CaseStudyProperty
                && (t.Phase == WorkflowTaskPhase.CaseStudy
                    || t.Phase == WorkflowTaskPhase.Obstruction
                    || t.Phase == WorkflowTaskPhase.Done),
            cancellationToken);

    /// <summary>An active reopening (not closed) of the deed's transaction with the study reopened.</summary>
    public Task<bool> HasActiveStudyReopeningAsync(Guid propertyId, CancellationToken cancellationToken) =>
        db.TransactionReopenings.AsNoTracking().AnyAsync(
            r => r.ReopensStudy
                && r.Status != TransactionReopeningStatuses.Closed
                && db.WorkOrderProperties.Any(p => p.Id == propertyId && p.TransactionId == r.TransactionId),
            cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        EfConcurrency.SaveAsync(db, cancellationToken);

    public Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);
}
