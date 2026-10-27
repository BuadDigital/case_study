// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D5   Automatic weights come from the GROSS adjustment (sequential + difference, absolute;
//         GrossAdjustmentPct) instead of the difference-factor sum.
//  • D6   An outlier comparable (adjusted unit rate far from the median; AdjustedUnitRate) gets no automatic
//         weight.
//  • D7   Whole-property basis: no area adjustment; the land table inside the cost approach is always
//         per m² (EffectiveBasis).
//  • D4   ExceedsLargeAdjustmentThreshold also fires on gross (not only net) above 40%.
//  • D7   Land table area adjustment compares with the apartment's land share when one is saved
//         (AreaAdjustmentSubjectAreaSqm).
// Round 2 (1b19bedc)
//  • A    Land table compares each land comparable with the whole building plot and multiplies the adjusted
//         rate by the apartment's share (CostLandAreas; AreaAdjustmentSubjectAreaSqm removed).
//  • R2-7 A market comparable dated after the valuation date (hard alert 23) gets automatic weight 0.
//  • A    The list DTO reports ApartmentLandShareSqm for the land table.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Pure helpers for building comparable lists and market adjustments — moved from selection service.
/// </summary>
public static class ValuationComparableListBuilder
{
    /// <summary>
    /// The default difference factors this selection is still missing (area + the four standard
    /// ones); catalog factors are added from the UI when needed. Returned rather than attached:
    /// adding through the navigation with a pre-generated id is treated by EF as an update of a
    /// missing row (UPDATE hits 0 rows → 409), so the caller stages them through the set.
    /// </summary>
    public static IReadOnlyList<ValuationComparableAdjustmentLine> MissingDifferenceFactorLines(
        ValuationComparableSelection row)
    {
        var existing = row.AdjustmentLines
            .Select(l => l.FactorKey)
            .ToHashSet(StringComparer.Ordinal);
        var start = row.AdjustmentLines.Count == 0
            ? 10
            : row.AdjustmentLines.Max(l => l.SortOrder) + 1;
        var lines = new List<ValuationComparableAdjustmentLine>();
        foreach (var key in MarketAdjustmentFactorKeys.DefaultDifferenceFactors)
        {
            if (existing.Contains(key)) continue;
            lines.Add(new ValuationComparableAdjustmentLine
            {
                Id = Guid.NewGuid(),
                SelectionId = row.Id,
                FactorKey = key,
                LabelAr = MarketAdjustmentFactorKeys.DefaultLabelAr(key),
                Percent = 0m,
                Rationale = "",
                IsIncluded = MarketAdjustmentFactorKeys.IncludedByDefault(key),
                SortOrder = start + lines.Count,
            });
        }

        return lines;
    }

    public static ValuationComparableSelectionListDto BuildList(
        ValuationRequest request,
        IReadOnlyList<ValuationComparableSelection> rows,
        IReadOnlyDictionary<Guid, ComparableProperty> comps,
        DateOnly valuationDate,
        ValuationMarketApproach? header,
        string selectionContext,
        IReadOnlyList<ValuationAdjustmentFactorRationale> factorRationales,
        DateOnly? hardComparableDateCutoff = null,
        CostLandAreas? costLand = null)
    {
        var adoptedRows = rows.Where(r => r.IsAdopted).ToList();
        // Decision A: the land table compares each land comparable with the whole building plot saved on
        // the cost approach (never the market header, which the subject-area sync owns); the apartment's
        // land share only multiplies the adjusted rate into the land value. The market table keeps the header.
        var isLandTable = ComparableSelectionContexts.Normalize(selectionContext)
            == ComparableSelectionContexts.LandWithinCost;
        var subjectArea = isLandTable
            ? CostApproachRules.LandTableSubjectAreaSqm(
                costLand?.BuildingPlotAreaSqm, costLand?.ApartmentShareSqm, header?.SubjectAreaSqm)
            : header?.SubjectAreaSqm;
        var valueArea = isLandTable
            ? CostApproachRules.LandTableValueAreaSqm(subjectArea, costLand?.ApartmentShareSqm)
            : subjectArea;
        var subjectAreaForSuggestion = subjectArea ?? 0m;
        var areaFactor = header?.AreaFactorPct > 0
            ? header.AreaFactorPct
            : AreaAdjustmentRules.DefaultAreaFactorPct;
        var marketRate = header?.AnnualMarketRatePct >= 0
            ? header.AnnualMarketRatePct
            : MarketApproachRules.DefaultAnnualMarketRatePct;
        var areaMethod = AreaAdjustmentRules.ChooseMethod(
            subjectAreaForSuggestion,
            adoptedRows
                .Where(r => comps.ContainsKey(r.ComparablePropertyId))
                .Select(r => EffectiveCompValues(r, comps[r.ComparablePropertyId]).Area));
        var basis = EffectiveBasis(header?.AdjustmentBasis, selectionContext);

        // D5 + D6: automatic weights from the GROSS adjustment (sequential + difference, absolute),
        // with no automatic weight for a comparable whose adjusted rate is an outlier against the
        // median. Manual override still replaces one row only; sum ≠ 100% stays an alert.
        var adoptedMarkets = adoptedRows
            .Where(r => comps.ContainsKey(r.ComparablePropertyId))
            .Select(r => (Row: r, Market: BuildMarket(
                r,
                comps[r.ComparablePropertyId],
                valuationDate,
                null,
                basis,
                subjectAreaForSuggestion,
                areaMethod,
                areaFactor,
                marketRate)))
            .ToList();
        var suggested = MarketApproachRules.SuggestWeights(
            adoptedMarkets.Select(x => x.Market.GrossAdjustmentPct()).ToList(),
            adoptedMarkets
                .Select(x => AdjustedUnitRate(
                    x.Market,
                    basis,
                    EffectiveCompValues(x.Row, comps[x.Row.ComparablePropertyId]).Area))
                .ToList(),
            // Round 2: a market comparable dealt after the valuation date (hard alert 23) gets no automatic weight.
            adoptedMarkets
                .Select(x => ComparableSelectionContexts.Normalize(selectionContext) == ComparableSelectionContexts.Market
                    && hardComparableDateCutoff is { } cutoff
                    && comps[x.Row.ComparablePropertyId].TransactionDate > cutoff)
                .ToList());

        var items = new List<ValuationComparableSelectionDto>();
        var weightPairs = new List<(decimal adjusted, decimal weight)>();
        var adoptedIndex = 0;

        foreach (var row in rows)
        {
            if (!comps.TryGetValue(row.ComparablePropertyId, out var comp))
                continue;

            decimal? suggestedForRow = null;
            if (row.IsAdopted && adoptedIndex < suggested.Count)
            {
                suggestedForRow = suggested[adoptedIndex];
                adoptedIndex++;
            }

            var market = BuildMarket(
                row,
                comp,
                valuationDate,
                suggestedForRow,
                basis,
                subjectAreaForSuggestion,
                areaMethod,
                areaFactor,
                marketRate);
            var eff = EffectiveCompValues(row, comp);
            items.Add(new ValuationComparableSelectionDto
            {
                Id = row.Id,
                ValuationRequestId = row.ValuationRequestId,
                ComparablePropertyId = row.ComparablePropertyId,
                SortOrder = row.SortOrder,
                IsAdopted = row.IsAdopted,
                SelectedByUserId = row.SelectedByUserId,
                SelectedAtUtc = row.SelectedAtUtc.ToString("o"),
                Comparable = ComparablePropertyMapping.ToDto(comp, valuationDate),
                Market = market,
                PriceOverrideSar = row.PriceOverrideSar,
                AreaOverrideSqm = row.AreaOverrideSqm,
                EffectivePriceSar = eff.Total,
                EffectiveAreaSqm = eff.Area,
                EffectivePricePerSqm = eff.Unit,
            });

            if (row.IsAdopted)
                weightPairs.Add((market.PricePerSqmAfterDifference, market.EffectiveWeightPct));
        }

        var effectiveWeights = weightPairs.Select(p => p.weight).ToList();
        var weighted = MarketApproachRules.WeightedUnitRate(weightPairs);
        var area = subjectArea;
        var roundDecimals = header?.ValueRoundDecimals
            ?? MarketApproachRules.DefaultValueRoundDecimals;
 // : whole-property basis yields the opinion directly — "without multiplying by area".
        // Cost logic §3: approach output is raw without rounding — round once after reconciliation.
        // Decision A: on the land table the rate multiplies the apartment's share, not the whole plot.
        var opinionRaw = basis == MarketAdjustmentBasisKeys.WholeProperty
            ? weighted
            : valueArea is > 0m
                ? MarketOpinionRules.ComputeOpinionValue(weighted, valueArea.Value)
                : 0m;
        var opinion = opinionRaw;

        return new ValuationComparableSelectionListDto
        {
            ValuationRequestId = request.Id,
            PropertyId = request.PropertyId.ToString("D"),
            SelectionContext = ComparableSelectionContexts.Normalize(selectionContext),
            AdoptedCount = adoptedRows.Count,
            MeetsMinimumAdoptedGate = ValuationComparableSelectionRules.MeetsMinimumAdopted(
                rows.Select(r => r.IsAdopted)),
            WeightsSumTo100 = adoptedRows.Count == 0
                || MarketApproachRules.WeightsSumTo100(effectiveWeights),
            WeightedPricePerSqm = weighted,
            SubjectAreaSqm = area,
            ApartmentLandShareSqm = isLandTable && costLand?.ApartmentShareSqm is > 0m
                ? costLand.Value.ApartmentShareSqm
                : null,
            AdjustmentBasis = basis,
            AdjustmentBasisLabelAr = MarketAdjustmentBasisKeys.LabelAr(basis),
            MarketOpinionValueRaw = opinionRaw,
            MarketOpinionValue = opinion,
            AreaFactorPct = areaFactor,
            AnnualMarketRatePct = marketRate,
            ValueRoundDecimals = roundDecimals,
            AnalysisNotes = header?.AnalysisNotes,
            SubjectSpecs = ParseSubjectSpecs(header?.SubjectSpecJson),
            FactorRationales = factorRationales
                .Select(r => new ValuationAdjustmentFactorRationaleDto
                {
                    SelectionContext = r.SelectionContext,
                    FactorKey = r.FactorKey,
                    RationaleAr = r.RationaleAr,
                })
                .ToList(),
            Items = items,
        };
    }

    /// <summary>
    /// D7: the land table inside the cost approach is always per m², whatever basis the market
    /// table uses (the header is shared by both tables).
    /// </summary>
    public static string EffectiveBasis(string? headerBasis, string? selectionContext) =>
        ComparableSelectionContexts.Normalize(selectionContext) == ComparableSelectionContexts.LandWithinCost
            ? MarketAdjustmentBasisKeys.PricePerSqm
            : MarketAdjustmentBasisKeys.Normalize(headerBasis);

    /// <summary>D6: adjusted rate per m² — on the whole-property basis the adjusted total ÷ the comparable's area.</summary>
    public static decimal AdjustedUnitRate(
        ValuationComparableMarketDto market,
        string adjustmentBasis,
        decimal comparableAreaSqm) =>
        adjustmentBasis == MarketAdjustmentBasisKeys.WholeProperty
            ? comparableAreaSqm > 0m
                ? Math.Round(market.PricePerSqmAfterDifference / comparableAreaSqm, 2, MidpointRounding.AwayFromZero)
                : 0m
            : market.PricePerSqmAfterDifference;

    /// <summary>D4/D5: Σ|%| of the included sequential and difference lines as the DTO carries them.</summary>
    public static decimal GrossAdjustmentPct(this ValuationComparableMarketDto market) =>
        MarketApproachRules.GrossAdjustmentPct(
            market.AdjustmentLines
                .Where(l => l.IsIncluded && MarketAdjustmentFactorKeys.IsSequential(l.FactorKey))
                .Select(l => l.Percent),
            market.AdjustmentLines
                .Where(l => l.IsIncluded && MarketAdjustmentFactorKeys.IsDifferenceFactor(l.FactorKey))
                .Select(l => l.Percent));

 /// <summary>compEdit: effective comparable values after this valuation's overrides — unit price = total ÷ area.</summary>
    public static (decimal Total, decimal Area, decimal Unit) EffectiveCompValues(
        ValuationComparableSelection row,
        ComparableProperty comp)
    {
        var total = row.PriceOverrideSar ?? comp.Price;
        var area = row.AreaOverrideSqm ?? comp.AreaSqm;
        var unit = area > 0m
            ? Math.Round(total / area, 2, MidpointRounding.AwayFromZero)
            : comp.PricePerSqm;
        return (total, area, unit);
    }

    private static readonly System.Text.Json.JsonSerializerOptions SubjectSpecJsonOptions = JsonDefaults.RelaxedEscaping;

    public static IReadOnlyDictionary<string, string> ParseSubjectSpecs(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, string>();
        try
        {
            return System.Text.Json.JsonSerializer
                       .Deserialize<Dictionary<string, string>>(json)
                   ?? new Dictionary<string, string>();
        }
        catch (System.Text.Json.JsonException)
        {
            return new Dictionary<string, string>();
        }
    }

    public static string? SerializeSubjectSpecs(IReadOnlyDictionary<string, string>? specs)
    {
        if (specs is null) return null;
        var clean = specs
            .Where(kv => !string.IsNullOrWhiteSpace(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
            .ToDictionary(kv => kv.Key.Trim(), kv => kv.Value.Trim(), StringComparer.Ordinal);
        return clean.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(clean, SubjectSpecJsonOptions);
    }

    public static ValuationComparableMarketDto BuildMarket(
        ValuationComparableSelection row,
        ComparableProperty comp,
        DateOnly valuationDate,
        decimal? suggestedWeightPct,
        string adjustmentBasis,
        decimal subjectAreaSqm,
        string areaMethod,
        decimal areaFactorPct,
        decimal annualMarketRatePct)
    {
        var ordered = row.AdjustmentLines.OrderBy(l => l.SortOrder).ToList();
        var eff = EffectiveCompValues(row, comp);
        // D7: on the whole-property basis the deal totals are compared as they are — a 5٪-per-
        // multiple area adjustment on a total price is not a size correction, so none is applied.
        var areaAdj = adjustmentBasis == MarketAdjustmentBasisKeys.WholeProperty
            ? 0m
            : AreaAdjustmentRules.SuggestPct(areaMethod, subjectAreaSqm, eff.Area, areaFactorPct);
        var dealAgeMonths = MarketApproachRules.DealAgeMonths(comp.TransactionDate, valuationDate);
        var suggestedMarket = MarketApproachRules.SuggestMarketConditionsPct(
            dealAgeMonths, annualMarketRatePct);
        var suggestedKind = MarketApproachRules.SuggestTransactionTypePct(
            comp.TransactionKind, comp.PriceDescription);

        var sequentialPct = ordered
            .Where(l => MarketAdjustmentFactorKeys.IsSequential(l.FactorKey))
            .Select(l => MarketApproachRules.EffectiveSequentialPercent(
                l.FactorKey,
                l.Percent,
                l.Rationale,
                l.IsIncluded,
                suggestedMarket,
                suggestedKind))
            .ToList();
        var differencePct = ordered
            .Where(l => l.IsIncluded && MarketAdjustmentFactorKeys.IsDifferenceFactor(l.FactorKey))
            .Select(l =>
                l.FactorKey == MarketAdjustmentFactorKeys.Area ? areaAdj : l.Percent)
            .ToList();

 // : the chain runs on the whole deal price or the unit rate per the basis (after compEdit overrides).
        var baseAmount = adjustmentBasis == MarketAdjustmentBasisKeys.WholeProperty
            ? eff.Total
            : eff.Unit;
        var (afterSeq, diffSum, afterDiff) = MarketApproachRules.ApplyMarketUnitRate(
            baseAmount,
            sequentialPct,
            differencePct);
        var sumAll = MarketApproachRules.SumIncludedPercents(
            sequentialPct.Concat(differencePct));
        var suggested = suggestedWeightPct ?? 0m;
        var effective = row.WeightIsManual && row.WeightPct is not null
            ? row.WeightPct.Value
            : suggested;

        return new ValuationComparableMarketDto
        {
            AdjustmentLines = ordered
                .Select(l =>
                {
                    var pct = l.FactorKey == MarketAdjustmentFactorKeys.Area
                        ? areaAdj
                        : MarketAdjustmentFactorKeys.IsSequential(l.FactorKey)
                            ? MarketApproachRules.EffectiveSequentialPercent(
                                l.FactorKey,
                                l.Percent,
                                l.Rationale,
                                l.IsIncluded,
                                suggestedMarket,
                                suggestedKind)
                            : l.Percent;
                    return new ValuationComparableAdjustmentLineDto
                    {
                        Id = l.Id,
                        FactorKey = l.FactorKey,
                        LabelAr = l.LabelAr,
                        Percent = pct,
                        Rationale = l.Rationale,
                        DescriptionAr = l.DescriptionAr,
                        IsIncluded = l.IsIncluded,
                        SortOrder = l.SortOrder,
                        // Every sequential factor is manual entry — nothing is ever "suggested until overridden".
                        IsSuggestedValue = false,
                    };
                })
                .ToList(),
            SumSequentialPct = MarketApproachRules.SumIncludedPercents(sequentialPct),
            SumDifferencePct = diffSum,
            SumIncludedPct = sumAll,
            // D4: net (kept) or gross (sequential + difference, absolute) above 40٪.
            ExceedsLargeAdjustmentThreshold = MarketApproachRules.ExceedsLargeAdjustmentThreshold(
                diffSum,
                MarketApproachRules.GrossAdjustmentPct(sequentialPct, differencePct)),
            DealAgeMonths = dealAgeMonths,
            SuggestedTransactionTypePct = suggestedKind,
            PricePerSqmAfterSequential = afterSeq,
            PricePerSqmAfterDifference = afterDiff,
            SuggestedWeightPct = suggested,
            EffectiveWeightPct = effective,
            WeightIsManual = row.WeightIsManual,
            WeightPct = row.WeightPct,
            WeightOverrideRationale = row.WeightOverrideRationale,
            AreaAdjustmentMethod = AreaAdjustmentMethods.Normalize(areaMethod),
            SuggestedAreaAdjustmentPct = areaAdj,
        };
    }
}
