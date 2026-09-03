using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationCostApproachService
{
    Task<ValuationCostApproachDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    Task<(ValuationCostApproachDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationCostApproachRequest request,
        CancellationToken cancellationToken = default);
}
