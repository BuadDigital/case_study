using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationIssuanceGateService
{
    Task<ValuationIssuanceGatesDto?> EvaluateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
