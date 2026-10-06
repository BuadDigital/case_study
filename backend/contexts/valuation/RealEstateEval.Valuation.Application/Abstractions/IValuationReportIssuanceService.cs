using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>Q-6: two-phase issuance + deposit certificate.</summary>
public interface IValuationReportIssuanceService
{
    Task<ValuationReportIssuanceStateDto?> GetStateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

 /// <summary>Q-6-1: when gates pass — full freeze + generate deposit copy (empty code field).</summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        IssueDepositAsync(
            Guid valuationRequestId,
            string? issuedByUserId,
            CancellationToken cancellationToken = default);

 /// <summary>Q-6-3/4: register certificate and code then generate final copy (certificate page + code in metadata).</summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        RegisterCertificateAsync(
            Guid valuationRequestId,
            RegisterDepositCertificateRequest request,
            string? uploadedByUserId,
            CancellationToken cancellationToken = default);

 /// <summary>
 /// The appraiser took his approval back before any deposit code was recorded: the current deposit
 /// copy is removed (nothing external was recorded, so no version number is spent). Idempotent —
 /// no current copy is a success; a recorded code or final copy is refused (that is a new version).
 /// </summary>
    Task<(bool Ok, string? Error)> WithdrawDepositAsync(
        Guid valuationRequestId,
        string? requestedByUserId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Q-9 supplement (R2): reopen valuation cycle after deposit — current copy is marked
 /// "superseded — replaced by a newer copy" (no hard delete); request reopens toward deposit copy N+1.
 /// </summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        ReopenAfterDepositAsync(
            Guid valuationRequestId,
            ReopenReportIssuanceRequest request,
            string? requestedByUserId,
            CancellationToken cancellationToken = default);
}
