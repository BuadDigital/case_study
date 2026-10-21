using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Case Study writes used by Financial (D4 document counters; survey-area backfill).
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
    Task<(CaseStudyTransactionNumbersDto? Result, string? Error)> ConfirmTransactionReferenceAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default);
}
