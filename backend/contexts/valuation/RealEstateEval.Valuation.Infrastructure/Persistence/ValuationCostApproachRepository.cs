using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IValuationCostApproachRepository"/>. The only place the cost
/// approach use case reaches <see cref="ValuationDbContext"/>.
/// </summary>
public sealed class ValuationCostApproachRepository(ValuationDbContext db)
    : IValuationCostApproachRepository
{
    public Task<ValuationRequest?> GetRequestAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);

    public Task<ValuationCostApproach?> GetWithItemsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationCostApproaches.AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.IndirectItems)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationCostApproach?> FindWithItemsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationCostApproaches
            .Include(x => x.Lines)
            .Include(x => x.IndirectItems)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task AddAsync(ValuationCostApproach entity, CancellationToken cancellationToken)
    {
        db.ValuationCostApproaches.Add(entity);
        return Task.CompletedTask;
    }

    public Task AddLineAsync(ValuationCostLine line, CancellationToken cancellationToken)
    {
        db.ValuationCostLines.Add(line);
        return Task.CompletedTask;
    }

    public Task RemoveLinesAsync(
        IReadOnlyCollection<ValuationCostLine> lines,
        CancellationToken cancellationToken)
    {
        db.ValuationCostLines.RemoveRange(lines);
        return Task.CompletedTask;
    }

    public Task AddIndirectItemAsync(
        ValuationIndirectCostItem item,
        CancellationToken cancellationToken)
    {
        db.ValuationIndirectCostItems.Add(item);
        return Task.CompletedTask;
    }

    public Task RemoveIndirectItemsAsync(
        IReadOnlyCollection<ValuationIndirectCostItem> items,
        CancellationToken cancellationToken)
    {
        db.ValuationIndirectCostItems.RemoveRange(items);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
