using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Case Study writes used by Financial (document counters; survey-area backfill).
/// The Case Study host uses EF; Financial calls HTTP. Do not open Case Study EF on Financial.
/// Failure side effects live on <see cref="ICaseStudyFailureCommands"/>.
/// </summary>
public interface ICaseStudyCommands
{
    Task<(string? Reference, string? Error)> AllocateDocumentReferenceAsync(
        string dept,
        string type,
        string dateKey,
        CancellationToken cancellationToken = default);

    Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirms the deed's transaction reference (PR-…) if it has none yet and returns the
    /// numbers derived from it; also stamps the valuation report number on the appraisal
    /// package. Called by Valuation when the appraiser approves the report. Idempotent.
    /// </summary>
    /// <remarks>
    /// How it works (Case Study owns it, numbering section 10): 1) the deed's
    /// transaction draws its official PR-YY-seq if it still carries TMP-…; 2) the PRV-… report number
    /// is derived from that root and stamped on the appraisal package of every deed of the
    /// transaction (one report, uploaded to Enfaz per deed); 3) returns transaction id, PR, PRC and PRV.
    /// Edge cases: PR is drawn once and never reused — a later call (reopen, retry) returns the same
    /// numbers; on failure Result is null and Error carries the Arabic reason.
    /// </remarks>
    Task<(CaseStudyTransactionNumbersDto? Result, string? Error)> ConfirmTransactionReferenceAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);
}
