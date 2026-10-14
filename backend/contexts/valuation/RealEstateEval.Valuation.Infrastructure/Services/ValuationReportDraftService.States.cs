using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

public sealed partial class ValuationReportDraftService
{
    /// <summary>Most properties one list read may ask about (a queue page, not the whole book).</summary>
    public const int MaxStatePropertyIds = 200;

    public async Task<IReadOnlyList<ReportDraftStateDto>> ListStatesAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default)
    {
        var ids = propertyIds.Distinct().Take(MaxStatePropertyIds).ToList();
        if (ids.Count == 0) return [];

        var requests = await db.ValuationRequests.AsNoTracking()
            .Where(x => ids.Contains(x.PropertyId))
            .Select(x => new { x.Id, x.PropertyId, x.UpdatedAtUtc })
            .ToListAsync(cancellationToken);
        var latest = requests
            .GroupBy(x => x.PropertyId)
            .Select(g => g.OrderByDescending(x => x.UpdatedAtUtc).First())
            .ToList();
        var requestIds = latest.Select(x => x.Id).ToList();

        var drafts = await db.ValuationReportDrafts.AsNoTracking()
            .Where(x => requestIds.Contains(x.ValuationRequestId))
            .Select(x => new { x.ValuationRequestId, x.Version, x.Status })
            .ToListAsync(cancellationToken);
        var issuances = await db.ValuationReportIssuances.AsNoTracking()
            .Where(x => requestIds.Contains(x.ValuationRequestId))
            .Select(x => new { x.ValuationRequestId, x.Version, x.SupersededAtUtc, x.FinalIssuedAtUtc })
            .ToListAsync(cancellationToken);

        var settings = await db.ValuationApproachSettings.AsNoTracking()
            .Where(x => requestIds.Contains(x.ValuationRequestId))
            .Select(x => new { x.ValuationRequestId, x.MarketApproachEnabled, x.CostApproachEnabled })
            .ToListAsync(cancellationToken);
        var adopted = await db.ValuationComparableSelections.AsNoTracking()
            .Where(x => requestIds.Contains(x.ValuationRequestId) && x.IsAdopted)
            .GroupBy(x => new { x.ValuationRequestId, x.SelectionContext })
            .Select(g => new { g.Key.ValuationRequestId, g.Key.SelectionContext, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var costSaved = (await db.ValuationCostApproaches.AsNoTracking()
            .Where(x => requestIds.Contains(x.ValuationRequestId))
            .Select(x => x.ValuationRequestId)
            .ToListAsync(cancellationToken)).ToHashSet();
        var opinionSaved = (await db.ValuationReconciliations.AsNoTracking()
            .Where(x => requestIds.Contains(x.ValuationRequestId))
            .Select(x => x.ValuationRequestId)
            .ToListAsync(cancellationToken)).ToHashSet();

        return latest.Select(vr =>
        {
            var own = issuances.Where(i => i.ValuationRequestId == vr.Id).ToList();
            var live = own.FirstOrDefault(i => i.SupersededAtUtc is null);
            // Same pick as the single read: the newest draft whose deposit copy was not superseded.
            var draft = drafts
                .Where(d => d.ValuationRequestId == vr.Id
                    && !own.Any(i => i.Version == d.Version && i.SupersededAtUtc is not null))
                .OrderByDescending(d => d.Version)
                .FirstOrDefault();
            var status = draft?.Status ?? "none";
            var stage = live is null
                ? ReportIssuanceStages.Draft
                : live.FinalIssuedAtUtc is not null ? ReportIssuanceStages.FinalIssued : ReportIssuanceStages.DepositIssued;
            var setting = settings.FirstOrDefault(x => x.ValuationRequestId == vr.Id);
            int Adopted(string context) => adopted
                .Where(x => x.ValuationRequestId == vr.Id && x.SelectionContext == context)
                .Sum(x => x.Count);
            var work = AppraiserProgressRules.Work(
                started: setting is not null,
                marketEnabled: setting?.MarketApproachEnabled ?? true,
                marketAdopted: Adopted(ComparableSelectionContexts.Market),
                costEnabled: setting?.CostApproachEnabled ?? true,
                landAdopted: Adopted(ComparableSelectionContexts.LandWithinCost),
                costSaved: costSaved.Contains(vr.Id),
                opinionSaved: opinionSaved.Contains(vr.Id));
            return new ReportDraftStateDto
            {
                PropertyId = vr.PropertyId,
                Status = status,
                ReportStage = stage,
                ProgressPct = AppraiserProgressRules.Overall(work, status, stage),
            };
        }).ToList();
    }
}
