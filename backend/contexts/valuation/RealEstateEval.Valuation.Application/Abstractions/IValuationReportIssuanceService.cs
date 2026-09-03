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
 /// Q-9 supplement (R2): reopen valuation cycle after deposit — current copy is marked
 /// "superseded — replaced by a newer copy" (no hard delete); request reopens toward deposit copy N+1.
 /// </summary>
    Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        ReopenAfterDepositAsync(
            Guid valuationRequestId,
            ReopenReportIssuanceRequest request,
            string? requestedByUserId,
            CancellationToken cancellationToken = default);

    Task<byte[]?> GetDepositPdfAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);

    Task<byte[]?> GetFinalPdfAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);
}
