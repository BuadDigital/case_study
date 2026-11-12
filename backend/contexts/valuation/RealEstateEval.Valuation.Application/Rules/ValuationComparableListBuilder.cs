// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Automatic weights come from the GROSS adjustment (sequential + difference, absolute;
//         GrossAdjustmentPct) instead of the difference-factor sum.
//  • An outlier comparable (adjusted unit rate far from the median; AdjustedUnitRate) gets no automatic
//         weight.
//  • Whole-property basis: no area adjustment; the land table inside the cost approach is always
//         per m² (EffectiveBasis).
//  • ExceedsLargeAdjustmentThreshold also fires on gross (not only net) above 40%.
//  • Land table area adjustment compares with the apartment's land share when one is saved
//         (AreaAdjustmentSubjectAreaSqm).
// Round 2 (1b19bedc)
//  • A    Land table compares each land comparable with the whole building plot and multiplies the adjusted
//         rate by the apartment's share (CostLandAreas; AreaAdjustmentSubjectAreaSqm removed).
//  • A market comparable dated after the valuation date (hard alert 23) gets automatic weight 0.
//  • A    The list DTO reports ApartmentLandShareSqm for the land table.
// Grey areas (2026-11-10)
//  • MarketOpinionValue is rounded by ValueRoundDecimals on the market table (RoundedOpinion);
//         MarketOpinionValueRaw and the land table inside the cost approach stay raw.
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
        CostLandAreas? costLand = null,
        bool roundOpinionValue = true,
        bool landSharedWithMarket = false)
    {
        var adoptedRows = rows.Where(r => r.IsAdopted).ToList();
        // The land table compares each land comparable with the whole building plot saved on
        // the cost approach (never the market header, which the subject-area sync owns); the apartment's
        // land share only multiplies the adjusted rate into the land value. The market table keeps the header.
        var isLandTable = ComparableSelectionContexts.Normalize(selectionContext)
            == ComparableSelectionContexts.LandWithinCost;
        // A built subject's market header holds its floor area (2026-10-29), never land.
        var subjectIsLand = ValuationApproachSettingsRules.IsLandPropertyType(request.PropertyType);
        var subjectArea = isLandTable
            ? CostApproachRules.LandTableSubjectAreaSqm(
                costLand?.BuildingPlotAreaSqm, costLand?.ApartmentShareSqm, header?.SubjectAreaSqm,
                headerIsLandArea: subjectIsLand)
            : header?.SubjectAreaSqm;
        var valueArea = isLandTable
            ? CostApproachRules.LandTableValueAreaSqm(subjectArea, costLand?.ApartmentShareSqm)
            : subjectArea;
        // One land table (2026-11-12): what the two approaches share is the comparison itself — the
        // same rows must give the same adjustments, adjusted amounts and weights in both. So the land
        // view of a shared table compares exactly as the market table does: against the market
        // header's area and on its basis. The plot the cost approach holds only multiplies the
        // result (valueArea) — that approach's own next step, like the market value's rounding.
        // Caught the same day: the land view compared against the cost approach's plot and always
        // per m², so the area adjustment — and the rate — could differ from the market table's.
        var comparesAsMarket = !isLandTable || landSharedWithMarket;
        var subjectAreaForSuggestion = (comparesAsMarket ? header?.SubjectAreaSqm : subjectArea) ?? 0m;
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
        var basis = EffectiveBasis(
            header?.AdjustmentBasis ?? MarketAdjustmentBasisKeys.DefaultFor(request.PropertyType, null),
            comparesAsMarket ? ComparableSelectionContexts.Market : selectionContext);

        // Automatic weights from the GROSS adjustment (sequential + difference, absolute),
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
            // Round 2: a comparable dealt after the valuation date (hard alert 23) gets no automatic
            // weight — in the market table and, since 2026-11-04 (A→Z #77), in the cost approach's
            // land table too (it used to enter the land rate at full weight).
            adoptedMarkets
                .Select(x => hardComparableDateCutoff is { } cutoff
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
        // On the land table the rate multiplies the apartment's share, not the whole plot.
        // The land table's value is always a rate per m² × its area, also when a shared table is
        // compared on whole prices: the rate is then the one the cost approach reads.
        var wholeBasis = basis == MarketAdjustmentBasisKeys.WholeProperty;
        var landRate = isLandTable && wholeBasis
            ? CostApproachRules.LandUnitRateFromAdoptedComps(
                items.Where(i => i.IsAdopted && i.Market is not null)
                    .Select(i => (i.Market!.PricePerSqmAfterDifference, i.EffectiveAreaSqm, i.Market.EffectiveWeightPct)),
                basis)
            : weighted;
        var opinionRaw = wholeBasis && !isLandTable
            ? weighted
            : valueArea is > 0m
                ? MarketOpinionRules.ComputeOpinionValue(landRate, valueArea.Value)
                : 0m;
        var opinion = RoundedOpinion(opinionRaw, roundDecimals, isLandTable, roundOpinionValue);

        return new ValuationComparableSelectionListDto
        {
            ValuationRequestId = request.Id,
            PropertyId = request.PropertyId.ToString("D"),
            SelectionContext = ComparableSelectionContexts.Normalize(selectionContext),
            LandSharedWithMarket = landSharedWithMarket,
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
                    // The table asked for: a land table read from the market rows says «land».
                    SelectionContext = ComparableSelectionContexts.Normalize(selectionContext),
                    FactorKey = r.FactorKey,
                    RationaleAr = r.RationaleAr,
                })
                .ToList(),
            Items = items,
        };
    }

    /// <summary>
    /// What: the market approach's value as the reconciliation, the report and the screen read it —
    /// the raw value rounded by the request's «تقريب القيمة» setting (ValueRoundDecimals: 4 → nearest
    /// 10,000, 0 → nearest riyal).
    /// How it works: <see cref="MarketOpinionRules.RoundMarketValue"/> on the market table only. The land
    /// table inside the cost approach stays raw (the cost approach reads its unit rate, and its land value
    /// is an input, not an approach value). <c>MarketOpinionValueRaw</c> always keeps the unrounded figure.
    /// Edge cases and what was fixed (2026-11-10): the rounding setting existed but nothing called it, so
    /// the market value went to the reconciliation unrounded. A request already frozen (deposited / done)
    /// passes <paramref name="round"/> = false and keeps the figure it was handed over with. A small value
    /// that would round to 0 (under half the rounding step) keeps its raw figure instead of vanishing.
    /// </summary>
    public static decimal RoundedOpinion(decimal raw, int decimals, bool isLandTable, bool round)
    {
        if (!round || isLandTable || raw <= 0m) return raw;
        var rounded = MarketOpinionRules.RoundMarketValue(raw, decimals);
        return rounded > 0m ? rounded : raw;
    }

    /// <summary>
    /// The land table inside the cost approach is always per m², whatever basis the market
    /// table uses (the header is shared by both tables). A land table that IS the market table
    /// (a subject valued as land, 2026-11-12) is asked as the market context and keeps its basis.
    /// </summary>
    public static string EffectiveBasis(string? headerBasis, string? selectionContext) =>
        ComparableSelectionContexts.Normalize(selectionContext) == ComparableSelectionContexts.LandWithinCost
            ? MarketAdjustmentBasisKeys.PricePerSqm
            : MarketAdjustmentBasisKeys.Normalize(headerBasis);

    /// <summary>Adjusted rate per m² — on the whole-property basis the adjusted total ÷ the comparable's area.</summary>
    public static decimal AdjustedUnitRate(
        ValuationComparableMarketDto market,
        string adjustmentBasis,
        decimal comparableAreaSqm) =>
        adjustmentBasis == MarketAdjustmentBasisKeys.WholeProperty
            ? comparableAreaSqm > 0m
                ? Math.Round(market.PricePerSqmAfterDifference / comparableAreaSqm, 2, MidpointRounding.AwayFromZero)
                : 0m
            : market.PricePerSqmAfterDifference;

    /// <summary>Σ|%| of the included sequential and difference lines as the DTO carries them.</summary>
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
        // On the whole-property basis the deal totals are compared as they are — a 5٪-per-
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
            // Net (kept) or gross (sequential + difference, absolute) above 40٪.
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
