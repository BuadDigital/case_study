using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationReconciliationService
{
    Task<ValuationReconciliationDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

 /// <summary>actorId feeds the audit trail — alert-pass resolutions are logged (س2).</summary>
    Task<(ValuationReconciliationDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationReconciliationRequest request,
        string? actorId = null,
        CancellationToken cancellationToken = default);
}
