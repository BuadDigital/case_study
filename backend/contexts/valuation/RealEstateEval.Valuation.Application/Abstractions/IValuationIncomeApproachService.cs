using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>D17 — income approach (direct capitalisation) read and save.</summary>
public interface IValuationIncomeApproachService
{
    Task<ValuationIncomeApproachDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    Task<(ValuationIncomeApproachDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationIncomeApproachRequest request,
        CancellationToken cancellationToken = default);
}
