using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationRequestService
{
    Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);
 /// <summary>Open (non-Done) request for the property, if any.</summary>
    Task<ValuationRequestDto?> GetOpenByPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default);
 /// <summary>
 /// Returns <c>valuation_already_open</c> when the property still has an unreported
 /// request, or <c>duplicate_display_id</c> for a caller-supplied identifier that is taken.
 /// </summary>
    Task<(ValuationRequestDto? Result, string? Error)> CreateAsync(
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default);
    /// <summary>
    /// Returns the open request for the property, creating one when distribution
    /// did not (or the lookup key differed only by GUID format).
    /// </summary>
    Task<(ValuationRequestDto? Result, string? Error)> EnsureOpenByPropertyAsync(
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default);
    Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
        Guid id,
        CancellationToken cancellationToken = default);
    Task<(ValuationRequestDto? Result, string? Error)> RecordImpedimentAsync(
        Guid id,
        ValuationImpedimentRequest request,
        CancellationToken cancellationToken = default);
}
