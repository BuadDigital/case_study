// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Alerts SaveAlertOverridesAsync — saves the methodology-alert dispositions alone (upsert by code,
//           audited) and creates an empty reconciliation row when none exists, so an alert acknowledgement is
//           saved without the methods rationale.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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

    /// <summary>
    /// The methodology-alert dispositions alone (upsert by code), audited like a full save. Creates an
    /// empty reconciliation row when none exists yet — the methods and rationale stay unsaved.
    /// </summary>
    Task<(ValuationReconciliationDto? Result, Dictionary<string, string>? Errors)> SaveAlertOverridesAsync(
        Guid valuationRequestId,
        SaveValuationAlertOverridesRequest request,
        string? actorId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Fix 4 (2026-11-10): writes the live projection's approach values and resolved basis/premise
    /// onto the stored reconciliation rows, so the request list — which reads the stored snapshot in
    /// one batched query — shows the same final value. Best-effort; never touches a frozen report.
    /// The default no-op keeps test doubles compiling.
    /// </summary>
    Task RefreshListSnapshotAsync(
        Guid valuationRequestId,
        ValuationReconciliationDto projection,
        CancellationToken cancellationToken = default) => Task.CompletedTask;

    /// <summary>Approaches the system values itself on this request (settings) — market / cost.</summary>
    Task<IReadOnlyList<string>> GetEnabledApproachKindsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
