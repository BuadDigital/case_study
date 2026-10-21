using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Phase 5 (decision 2026-10-19): one valuation per transaction. When the case-study specialist
/// merges transactions, the moved deeds' open valuation requests fold into the holder deed's
/// request; unmerging a deed reopens its own. Case Study calls this over HTTP; the Valuation host
/// implements it on its own tables. Kept apart from <see cref="IValuationRequestService"/> so the
/// many fakes of that port stay untouched.
/// </summary>
public interface IValuationRequestFolding
{
    /// <summary>
    /// Marks every open request of <c>PropertyIds</c> as merged into the holder deed's open request.
    /// Deeds without an open request are skipped. Idempotent.
    /// </summary>
    Task<FoldValuationRequestsResultDto> FoldAsync(
        FoldValuationRequestsRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Reopens the deed's merged request as its own (status back to in progress). Idempotent.</summary>
    Task<FoldValuationRequestsResultDto> UnfoldAsync(
        UnfoldValuationRequestRequest request,
        CancellationToken cancellationToken = default);
}
