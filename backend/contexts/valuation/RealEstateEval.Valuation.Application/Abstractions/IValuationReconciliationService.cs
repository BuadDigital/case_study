using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationReconciliationService
{
    Task<ValuationReconciliationDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

 /// <summary>actorId feeds the audit trail — alert-pass resolutions are logged (S2).</summary>
    Task<(ValuationReconciliationDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationReconciliationRequest request,
        string? actorId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Approaches the system values itself on this request (Q-2 settings) — market / cost.</summary>
    Task<IReadOnlyList<string>> GetEnabledApproachKindsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
