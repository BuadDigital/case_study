using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkOrderPropertyRepository(CaseStudyDbContext db) : IWorkOrderPropertyRepository
{
    public Task<(string? Number, string? Error)> AllocateTransactionDraftNumberAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken) =>
        ReferenceSequenceAllocator.AllocateYearlyAsync(
            db,
            DatabaseSchemas.CaseStudy,
            ReferenceNumbering.TransactionDraft,
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
        db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.Contacts)
            .FirstAsync(p => p.Id == propertyId, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        EfConcurrency.SaveAsync(db, cancellationToken);

    public Task ExecuteInTransactionAsync(
        Func<CancellationToken, Task> action,
        CancellationToken cancellationToken) =>
        DbContextTransaction.ExecuteInTransactionAsync((DbContext)db, action, cancellationToken);
}
