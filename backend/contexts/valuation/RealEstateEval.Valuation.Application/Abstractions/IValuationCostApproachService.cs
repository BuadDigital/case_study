using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

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
