using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationIssuanceGateService
{
    Task<ValuationIssuanceGatesDto?> EvaluateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
