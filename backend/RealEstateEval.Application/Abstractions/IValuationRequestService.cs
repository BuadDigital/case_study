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

    /// <summary>
    /// none | preparing | ready for the property's latest issued valuation report; null when it has
    /// none or the status cannot be read (callers then do not block on it).
    /// </summary>
    Task<string?> GetFinalReportStatusByPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<string?>(null);

    /// <summary>
    /// The request's issuance gates (the appraiser's hand-over is refused while one he can fix
    /// blocks). Null when the request is gone or this host cannot read them; a failed read throws.
    /// </summary>
    Task<ValuationIssuanceGatesSnapshotDto?> GetIssuanceGatesAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<ValuationIssuanceGatesSnapshotDto?>(null);

    /// <summary>
    /// The reconciliation's final value (the figure the report prints) — the appraiser's hand-over
    /// price must equal it. Null when there is no reconciliation or this host cannot read it; a
    /// failed read throws.
    /// </summary>
    Task<decimal?> GetFinalOpinionValueAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<decimal?>(null);
}
