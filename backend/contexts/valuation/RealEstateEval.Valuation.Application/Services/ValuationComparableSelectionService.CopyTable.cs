using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

public sealed partial class ValuationComparableSelectionService
{
    public const string CopyNothingToCopyAr = "لا مقارنات معتمدة في الجدول المصدر لنسخها";

    public const string CopyTargetNotEmptyAr =
        "الجدول فيه مقارنات — النسخ يستبدلها بمقارنات الجدول الآخر وتسوياته، ويلزم تأكيد الاستبدال";

    /// <summary>
    /// What: copies the land valuation by comparable sales from one table of a valuation to the other —
    /// the market approach's table and «تقدير قيمة الأرض فضاءً» inside the cost approach (ruling
    /// 2026-11-11). The appraiser who valued the land in one no longer re-enters it in the other.
    ///
    /// How it works: the adopted comparables of the source go to the target with everything saved on
    /// them — adjustment lines (percent, rationale, description, in/out), weight (and its manual
    /// override and rationale), the area adjustment method and the per-valuation price / area
    /// overrides — and the source's factor rationales replace the target's. The copy is a snapshot: the
    /// two tables stay independent afterwards and each is edited freely. The shared market header
    /// (basis, subject descriptions) is one per valuation, so there is nothing of it to copy.
    ///
    /// Edge cases:
    /// - A target that already holds comparables is refused unless <c>Replace</c> is set; then its rows
    ///   and factor rationales are removed first. A property-linked comparable removed that way is
    ///   recorded as dismissed, so the linked-comparable import does not bring it back; one that is
    ///   copied in is no longer dismissed.
    /// - Only land goes into the land table: a built comparable (فيلا، شقة، عمارة…) of the source is
    ///   left out and counted in <c>SkippedBuiltCount</c>. The other direction copies the land table
    ///   as it is.
    /// - A source with no adopted comparable copies nothing and is refused — never an emptied target.
    /// - Un-adopted rows of the source are not copied: they carry no part of the valuation.
    /// - Refused while the valuation's writes are closed (handed over / deposited), like every edit.
    /// </summary>
    public async Task<(CopyValuationComparableTableResultDto? Result, Dictionary<string, string>? Errors)>
        CopyTableAsync(
            Guid valuationRequestId,
            CopyValuationComparableTableRequest request,
            string selectedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });

        var blocked = await freeze.GetWriteBlockedMessageAsync(
            vr, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

        if (ValuationComparableSelectionRequestRules.SelectionContextError(request.FromContext) is { } fromError)
            return (null, new Dictionary<string, string> { ["fromContext"] = fromError });
        if (ValuationComparableSelectionRequestRules.SelectionContextError(request.ToContext) is { } toError)
            return (null, new Dictionary<string, string> { ["toContext"] = toError });

        var from = ComparableSelectionContexts.Normalize(request.FromContext);
        var to = ComparableSelectionContexts.Normalize(request.ToContext);
        if (from == to)
            return (null, new Dictionary<string, string> { ["toContext"] = "الجدول المصدر والهدف واحد" });

        var adopted = (await repo.ListSelectionsAsync(valuationRequestId, from, cancellationToken))
            .Where(s => s.IsAdopted)
            .ToList();
        var skippedBuilt = 0;
        if (to == ComparableSelectionContexts.LandWithinCost)
        {
            var comps = await repo.GetComparablesAsync(
                adopted.Select(s => s.ComparablePropertyId).Distinct().ToList(), cancellationToken);
            var land = adopted
                .Where(s => comps.TryGetValue(s.ComparablePropertyId, out var comp)
                    && !PropertyCategoryRules.IsBuiltType(comp.ComparablePropertyType))
                .ToList();
            skippedBuilt = adopted.Count - land.Count;
            adopted = land;
        }

        if (adopted.Count == 0)
            return (null, new Dictionary<string, string> { ["_"] = CopyNothingToCopyAr });

        var existing = await repo.FindSelectionsAsync(valuationRequestId, to, cancellationToken);
        if (existing.Count > 0 && !request.Replace)
            return (null, new Dictionary<string, string> { ["replace"] = CopyTargetNotEmptyAr });

        var copiedIds = adopted.Select(s => s.ComparablePropertyId).ToHashSet();
        if (existing.Count > 0)
        {
            await repo.RemoveSelectionsAsync(existing, cancellationToken);
            await DismissLinkedAsync(
                vr,
                existing.Select(x => x.ComparablePropertyId).Where(id => !copiedIds.Contains(id)).Distinct().ToList(),
                cancellationToken);
        }
        await repo.ClearDismissedLinkedComparablesAsync(valuationRequestId, copiedIds.ToList(), cancellationToken);

        var now = _time.UtcNow();
        for (var i = 0; i < adopted.Count; i++)
        {
            var source = adopted[i];
            var selectionId = Guid.NewGuid();
            await repo.AddSelectionAsync(
                new ValuationComparableSelection
                {
                    Id = selectionId,
                    ValuationRequestId = valuationRequestId,
                    ComparablePropertyId = source.ComparablePropertyId,
                    SelectionContext = to,
                    SortOrder = i,
                    IsAdopted = true,
                    SelectedByUserId = selectedByUserId,
                    SelectedAtUtc = now,
                    WeightPct = source.WeightPct,
                    WeightIsManual = source.WeightIsManual,
                    WeightOverrideRationale = source.WeightOverrideRationale,
                    AreaAdjustmentMethod = source.AreaAdjustmentMethod,
                    PriceOverrideSar = source.PriceOverrideSar,
                    AreaOverrideSqm = source.AreaOverrideSqm,
                },
                cancellationToken);

            var lines = source.AdjustmentLines.Count == 0
                ? MarketApproachRules.CreateStandardMarketLines(selectionId).ToList()
                : source.AdjustmentLines
                    .OrderBy(l => l.SortOrder)
                    .Select(l => new ValuationComparableAdjustmentLine
                    {
                        Id = Guid.NewGuid(),
                        SelectionId = selectionId,
                        FactorKey = l.FactorKey,
                        LabelAr = l.LabelAr,
                        Percent = l.Percent,
                        Rationale = l.Rationale,
                        DescriptionAr = l.DescriptionAr,
                        IsIncluded = l.IsIncluded,
                        SortOrder = l.SortOrder,
                    })
                    .ToList();
            await repo.AddAdjustmentLinesAsync(lines, cancellationToken);
        }

        foreach (var old in await repo.ListFactorRationalesAsync(valuationRequestId, to, cancellationToken))
        {
            // The list is read untracked; the tracked row is what gets removed.
            var tracked = await repo.FindFactorRationaleAsync(
                valuationRequestId, to, old.FactorKey, cancellationToken);
            if (tracked is not null) await repo.RemoveFactorRationaleAsync(tracked, cancellationToken);
        }
        foreach (var rationale in await repo.ListFactorRationalesAsync(valuationRequestId, from, cancellationToken))
        {
            await repo.AddFactorRationaleAsync(
                new ValuationAdjustmentFactorRationale
                {
                    Id = Guid.NewGuid(),
                    ValuationRequestId = valuationRequestId,
                    SelectionContext = to,
                    FactorKey = rationale.FactorKey,
                    RationaleAr = rationale.RationaleAr,
                    UpdatedAtUtc = now,
                    UpdatedByUserId = selectedByUserId,
                },
                cancellationToken);
        }

        await EnsureMarketApproachHeaderAsync(valuationRequestId, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);

        return (
            new CopyValuationComparableTableResultDto
            {
                Target = (await ListAsync(valuationRequestId, to, cancellationToken))!,
                CopiedCount = adopted.Count,
                SkippedBuiltCount = skippedBuilt,
            },
            null);
    }
}
