using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// The valuation-report draft: after the appraiser hands his package over, the case specialist
/// prepares the report and sends it; the appraiser approves it (which freezes it as the deposit
/// copy) and later records the Qeema deposit code. Every write names its actor; the service
/// enforces who may do what (specialist: prepare / send / withdraw; the assigned appraiser: approve /
/// withdraw his approval).
/// </summary>
public interface IValuationReportDraftService
{
    /// <summary>The current draft, or a <c>none</c> state saying whether the specialist may start. Null: no such request.</summary>
    Task<ValuationReportDraftDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>The draft state of the property's latest valuation request (any status), or null when it has none.</summary>
    Task<ValuationReportDraftDto?> GetByPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);

    /// <summary>Draft state of many properties at once (queue labels); properties without a valuation request are left out.</summary>
    Task<IReadOnlyList<ReportDraftStateDto>> ListStatesAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default);

    Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> SaveChoicesAsync(
        Guid valuationRequestId,
        SaveReportDraftChoicesRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> SendAsync(
        Guid valuationRequestId,
        SendReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>The specialist pulls a sent draft back to preparing (idempotent).</summary>
    Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> WithdrawAsync(
        Guid valuationRequestId,
        WithdrawReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The report number PRV-… for the request: fixed already, or confirmed now through Case Study
    /// (the transaction's official reference). Only the assigned appraiser, only once the draft was sent.
    /// </summary>
    /// <remarks>
    /// How it works: a request that already has its number returns it; otherwise, when the draft was
    /// sent, Case Study confirms the transaction's PR (drawn once) and the derived PRV-YY-seq is stored
    /// on the request (decision 2026-10-19).
    /// Edge cases: a draft not yet sent gets no number; an unreachable or failing Case Study returns an
    /// Arabic error and stores nothing; once set the number never changes, so a reopened report keeps
    /// it (prod PO-067455 kept PR-26-00002 after a reopen 21 s later).
    /// </remarks>
    Task<(ValuationReportNumberDto? Result, Dictionary<string, string>? Errors)> EnsureReportNumberAsync(
        Guid valuationRequestId,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>The assigned appraiser approves the sent draft: the report freezes as the deposit copy (idempotent).</summary>
    Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> ApproveAsync(
        Guid valuationRequestId,
        ApproveReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>The assigned appraiser takes his approval back — only before a deposit code is recorded; no version is spent.</summary>
    Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> WithdrawApprovalAsync(
        Guid valuationRequestId,
        WithdrawReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The assigned appraiser records the Qeema deposit code and the one-page PDF certificate: the final copy is
    /// issued, the request closes and his task completes. A later call corrects the code (audited, no new version).
    /// </summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)> RecordDepositAsync(
        Guid valuationRequestId,
        RegisterDepositCertificateRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The case specialist reopens a deposited report as a new version (n+1): the appraiser's package and task
    /// open again and the report starts a new cycle with the same report number.
    /// </summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)> ReopenNewVersionAsync(
        Guid valuationRequestId,
        ReopenReportIssuanceRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>The same reopen for the property's deposited request (what Enfaz return and recall know).</summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)> ReopenNewVersionByPropertyAsync(
        Guid propertyId,
        ReopenReportIssuanceRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The generated final PDF of the current copy — for the case specialist, management and the assigned appraiser.
    /// An error with <c>_</c> says it is not ready yet.
    /// </summary>
    Task<(FinalReportFile? File, Dictionary<string, string>? Errors)> GetFinalReportAsync(
        Guid valuationRequestId,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);

    /// <summary>Retries generating the final PDF (renderer was down, or the code changed); returns the resulting status.</summary>
    Task<(string? Status, Dictionary<string, string>? Errors)> RegenerateFinalReportAsync(
        Guid valuationRequestId,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default);
}
