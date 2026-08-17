using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationApproachSettingsService
{
    Task<ValuationApproachSettingsDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    Task<(ValuationApproachSettingsDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationApproachSettingsRequest request,
        CancellationToken cancellationToken = default);
}
