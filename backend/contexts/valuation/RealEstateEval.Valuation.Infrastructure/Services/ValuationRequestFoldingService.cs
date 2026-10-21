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

        var rows = await db.ValuationRequests
            .Where(x => ids.Contains(x.PropertyId) && x.Status != ValuationRequestStatus.Done)
            .ToListAsync(cancellationToken);
        var now = _time.UtcNow();
        var folded = rows.Count(row => row.MarkMerged(holderRequestId, now));
        if (folded > 0) await db.SaveChangesAsync(cancellationToken);
        return new FoldValuationRequestsResultDto { FoldedCount = folded, HolderRequestId = holderRequestId };
    }

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
