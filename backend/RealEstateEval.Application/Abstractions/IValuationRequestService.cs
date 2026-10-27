using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationRequestService
{
    Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);
    /// <summary>The property's open valuation request — its own, or the holder deed's when it was folded.</summary>
    /// <remarks>
    /// How it works: 1) normalises the property id (empty → null). 2) Takes the latest request of the
    /// property that is neither done nor merged. 3) If none, takes the latest merged row's
    /// MergedIntoRequestId and loads that holder request. 4) Reads the current (not superseded) issuance's
    /// stage — final issued / deposit issued / draft — and returns the request with that ReportStage.
    /// Edge cases (phase 5): a folded deed reads the holder's request while it is open, so the per-deed
    /// gates keep working; once the holder's request is done (or missing, or folded with a null holder
    /// before distribution) it returns null. Step 2 treats merged as not open, as the open-per-property
    /// unique index does.
    /// </remarks>
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

    /// <summary>The status of the property's final valuation report: none | preparing | ready, or null.</summary>
    /// <remarks>
    /// How it works: takes the newest NON-superseded issuance of the property's requests (a merged deed
    /// uses its holder's request, MergedIntoRequestId ?? Id) and returns its FinalReportStatus; case study
    /// reads it before the Enfaz handover. Edge cases and fixes: after a return from Enfaz the replaced
    /// copy used to be read — now skipped, so the answer is null until the new cycle issues a copy (null
    /// does not block; the stage gates do); a merged deed used to read null while the holder's PDF was
    /// still preparing — it now reads the holder's status. An empty id returns null; null also when the status cannot be read (callers then do not block on it).
    /// </remarks>
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
