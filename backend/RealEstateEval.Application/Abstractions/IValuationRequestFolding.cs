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
    /// <remarks>
    /// How it works: finds the holder deed's open request (not done, not merged), then marks every
    /// not-done request of the given deeds merged into it; returns FoldedCount and HolderRequestId.
    /// Edge cases: a done request is never folded; a row already merged into the same request does not
    /// count again. Since 2026-10-21 a merge may come before distribution, so the holder may have no
    /// request yet: the deeds fold with a null target, and the valuation dispatch folds again once the
    /// holder's request exists, re-pointing those rows at it.
    /// </remarks>
    Task<FoldValuationRequestsResultDto> FoldAsync(
        FoldValuationRequestsRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Reopens the deed's merged request as its own (status back to in progress). Idempotent.</summary>
    /// <remarks>
    /// How it works: takes the deed's latest merged request, sets it back to progress and clears
    /// MergedIntoRequestId; FoldedCount = 1 when it changed, 0 when there was nothing to unfold (never
    /// folded or already unfolded). Used when the specialist takes a deed back out of a transaction.
    /// </remarks>
    Task<FoldValuationRequestsResultDto> UnfoldAsync(
        UnfoldValuationRequestRequest request,
        CancellationToken cancellationToken = default);
}
