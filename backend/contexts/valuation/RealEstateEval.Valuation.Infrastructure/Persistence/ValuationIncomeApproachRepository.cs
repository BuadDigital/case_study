using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IValuationIncomeApproachRepository"/>. The only place the income
/// approach use case (D17) reaches <see cref="ValuationDbContext"/>.
/// </summary>
public sealed class ValuationIncomeApproachRepository(ValuationDbContext db)
    : IValuationIncomeApproachRepository
{
    public Task<ValuationRequest?> GetRequestAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);

    public Task<ValuationIncomeApproach?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationIncomeApproaches.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationIncomeApproach?> FindAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationIncomeApproaches
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task AddAsync(ValuationIncomeApproach entity, CancellationToken cancellationToken)
    {
        db.ValuationIncomeApproaches.Add(entity);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
