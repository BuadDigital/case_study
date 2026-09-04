using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IValuationReconciliationRepository"/>. The only place the
/// reconciliation use case reaches <see cref="ValuationDbContext"/>.
/// </summary>
public sealed class ValuationReconciliationRepository(ValuationDbContext db)
    : IValuationReconciliationRepository
{
    public Task<ValuationRequest?> GetRequestAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);

    public Task<ValuationReconciliation?> GetWithMethodsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationReconciliations.AsNoTracking()
            .Include(x => x.Methods)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationReconciliation?> FindWithMethodsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationReconciliations
            .Include(x => x.Methods)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task<ValuationApproachSettings?> GetApproachSettingsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

    public Task AddAsync(ValuationReconciliation entity, CancellationToken cancellationToken)
    {
        db.ValuationReconciliations.Add(entity);
        return Task.CompletedTask;
    }

    public Task AddMethodLineAsync(
        ValuationReconciliationMethodLine line,
        CancellationToken cancellationToken)
    {
        db.ValuationReconciliationMethodLines.Add(line);
        return Task.CompletedTask;
    }

    public Task RemoveMethodLinesAsync(
        IReadOnlyCollection<ValuationReconciliationMethodLine> lines,
        CancellationToken cancellationToken)
    {
        db.ValuationReconciliationMethodLines.RemoveRange(lines);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
