using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>EF adapter of <see cref="ITransactionCancellationRepository"/> — deeds come with their work order and transaction.</summary>
public sealed class TransactionCancellationRepository(CaseStudyDbContext db) : ITransactionCancellationRepository
{
    private IQueryable<WorkOrderProperty> Deeds =>
        db.WorkOrderProperties
            .Include(p => p.WorkOrder)
            .Include(p => p.Transaction);

    public Task<WorkOrderProperty?> GetDeedAsync(Guid propertyId, CancellationToken cancellationToken) =>
        Deeds.FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

    public async Task<IReadOnlyList<WorkOrderProperty>> ListTransactionDeedsAsync(
        Guid transactionId,
        CancellationToken cancellationToken) =>
        await Deeds.Where(p => p.TransactionId == transactionId).ToListAsync(cancellationToken);

    /// <summary>Every deed of every transaction that has a deed on the work order.</summary>
    /// <remarks>
    /// How it works: one query — the transaction ids of the PO's deeds, then every deed with one of them.
    /// Edge cases: an unknown PO yields an empty list (the service reports «أمر العمل غير موجود»).
    /// </remarks>
    public async Task<IReadOnlyList<WorkOrderProperty>> ListWorkOrderTransactionDeedsAsync(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var transactionIds = db.WorkOrderProperties
            .Where(p => p.WorkOrder!.PoNumber == po)
            .Select(p => p.TransactionId);
        return await Deeds
            .Where(p => transactionIds.Contains(p.TransactionId))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<WorkOrderProperty>> ListDeedsByIdsAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0) return [];
        return await Deeds.Where(p => propertyIds.Contains(p.Id)).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<WorkflowTask>> ListTasksForUpdateAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0) return [];
        return await db.WorkflowTasks
            .Where(t => t.PropertyId != null && propertyIds.Contains(t.PropertyId.Value))
            .ToListAsync(cancellationToken);
    }

    public Task<TransactionCancellation?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        db.TransactionCancellations.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<TransactionCancellation>> ListAsync(
        string? status,
        CancellationToken cancellationToken)
    {
        var query = db.TransactionCancellations.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(c => c.Status == status);
        return await query
            .OrderByDescending(c => c.RequestedAtUtc)
            .Take(500)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(TransactionCancellation request, CancellationToken cancellationToken) =>
        await db.TransactionCancellations.AddAsync(request, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
