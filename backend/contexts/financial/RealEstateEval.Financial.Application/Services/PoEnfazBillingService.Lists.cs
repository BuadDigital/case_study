using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// The filtered / paged reads of docs/architecture/pagination-contract.md §10. Both lists are
/// synthesised from cross-context reads, so the search and sort run over the materialised rows
/// and the page is cut from that same list — its length is the envelope's count.
/// </summary>
public sealed partial class PoEnfazBillingService
{
    public async Task<IReadOnlyList<EnfazReadyPoSummaryDto>> ListReadyPoSummariesAsync(
        EnfazReadyPoListQuery query,
        CancellationToken cancellationToken = default)
    {
        var scanned = await ListReadyPoSummariesAsync(cancellationToken);
        return EnfazReadyPoListQueryRules.Apply(scanned, query);
    }

    public async Task<PagedResultDto<EnfazReadyPoSummaryDto>> ListReadyPoSummariesPagedAsync(
        EnfazReadyPoListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var scanned = await ListReadyPoSummariesAsync(cancellationToken);
        return MaterialisedListPage.Cut(
            EnfazReadyPoListQueryRules.Apply(scanned, query), skip, take, page);
    }

    public async Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        EnfazTrackingListQuery query,
        CancellationToken cancellationToken = default)
    {
        var scanned = await ScanTrackingRowsAsync(cancellationToken);
        return EnfazTrackingListQueryRules.Apply(scanned, query)
            .Take(MaxTrackingRows)
            .ToList();
    }

    public async Task<PagedResultDto<EnfazTrackingRowDto>> ListTrackingPagedAsync(
        EnfazTrackingListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default)
    {
        var scanned = await ScanTrackingRowsAsync(cancellationToken);
        return MaterialisedListPage.Cut(
            EnfazTrackingListQueryRules.Apply(scanned, query), skip, take, page);
    }
}
