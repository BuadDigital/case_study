using RealEstateEval.Application.Abstractions;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IValuationReportFreezeGate"/>, delegating to the same predicate
/// the Infrastructure issuance service uses so both answers can never drift. The Case Study
/// lookup is optional: without it only the deposit layer applies.
/// </summary>
public sealed class ValuationReportFreezeGate(ValuationDbContext db, ICaseStudyLookup? caseStudy = null)
    : IValuationReportFreezeGate
{
    public Task<bool> IsFrozenAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        ValuationReportFreeze.IsFrozenAsync(db, valuationRequestId, cancellationToken);

    public Task<string?> GetFrozenMessageAsync(
        Guid valuationRequestId,
        Guid propertyId,
        CancellationToken cancellationToken = default) =>
        ValuationReportFreeze.GetFrozenMessageAsync(
            db, caseStudy, valuationRequestId, propertyId, cancellationToken);
}
