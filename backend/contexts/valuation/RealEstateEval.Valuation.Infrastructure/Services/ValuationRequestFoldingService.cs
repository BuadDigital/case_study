using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Phase 5 (decision 2026-10-19): one valuation per transaction. A merge folds the moved deeds'
/// open requests into the holder deed's request (status <c>merged</c>, <c>MergedIntoRequestId</c>);
/// an unmerge gives the deed its own request back. Both are idempotent.
/// </summary>
public sealed class ValuationRequestFoldingService(
    ValuationDbContext db,
    TimeProvider? time = null) : IValuationRequestFolding
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    /// <summary>Folds the given deeds' valuation requests into the holder deed's open request.</summary>
    /// <remarks>
    /// How it works: 1) cleans PropertyIds (drops Guid.Empty, de-duplicates). 2) Finds the holder's open
    /// request — latest UpdatedAtUtc on HolderPropertyId that is neither done nor merged (may be null).
    /// 3) With no ids, returns just that HolderRequestId. 4) Loads every not-done request of the ids and
    /// calls <c>MarkMerged(holderRequestId)</c> on each; saves only when one changed. Returns FoldedCount
    /// and HolderRequestId.
    /// Edge cases: idempotent — a row already merged into the same request does not count, and a done
    /// request is never folded. Unknown property ids simply match no row. Holder with no request yet
    /// (merge before distribution, 2026-10-21): rows fold with a null target and a later fold from the
    /// valuation dispatch re-points them at the holder's new request.
    /// </remarks>
    public async Task<FoldValuationRequestsResultDto> FoldAsync(
        FoldValuationRequestsRequest request,
        CancellationToken cancellationToken = default)
    {
        var ids = (request.PropertyIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList();
        var holderRequestId = await db.ValuationRequests.AsNoTracking()
            .Where(x => x.PropertyId == request.HolderPropertyId
                && x.Status != ValuationRequestStatus.Done
                && x.Status != ValuationRequestStatus.Merged)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (ids.Count == 0) return new FoldValuationRequestsResultDto { HolderRequestId = holderRequestId };

        // Decision 2026-10-21: a merge may come before distribution, so the holder may have no open
        // request yet. The deeds still fold (no target); the valuation dispatch folds again once the
        // holder's request exists, and MarkMerged then re-points an already merged row at it.
        var rows = await db.ValuationRequests
            .Where(x => ids.Contains(x.PropertyId) && x.Status != ValuationRequestStatus.Done)
            .ToListAsync(cancellationToken);
        var now = _time.UtcNow();
        var folded = rows.Count(row => row.MarkMerged(holderRequestId, now));
        if (folded > 0) await db.SaveChangesAsync(cancellationToken);
        return new FoldValuationRequestsResultDto { FoldedCount = folded, HolderRequestId = holderRequestId };
    }

    /// <summary>A deed taken out of its transaction gets its own valuation request back.</summary>
    /// <remarks>
    /// How it works: finds the deed's latest merged request (by UpdatedAtUtc), calls <c>Unmerge</c>
    /// (status back to progress, MergedIntoRequestId cleared) and saves. Returns FoldedCount = 1, or an
    /// empty result when nothing changed.
    /// Edge cases: idempotent — a deed with no merged request (never folded, or already unfolded) returns
    /// FoldedCount = 0 without saving.
    /// </remarks>
    public async Task<FoldValuationRequestsResultDto> UnfoldAsync(
        UnfoldValuationRequestRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await db.ValuationRequests
            .Where(x => x.PropertyId == request.PropertyId && x.Status == ValuationRequestStatus.Merged)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null || !row.Unmerge(_time.UtcNow())) return new FoldValuationRequestsResultDto();
        await db.SaveChangesAsync(cancellationToken);
        return new FoldValuationRequestsResultDto { FoldedCount = 1 };
    }
}
