using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>EF adapter for <see cref="IValuationRequestLookup"/>.</summary>
public sealed class ValuationRequestLookup(ValuationDbContext db) : IValuationRequestLookup
{
    public Task<ValuationRequest?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken) =>
        db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
}
