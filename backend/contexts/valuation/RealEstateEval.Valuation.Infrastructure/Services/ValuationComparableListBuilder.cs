using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Pure helpers for building comparable lists and market adjustments — moved from selection service.
/// </summary>
internal static class ValuationComparableListBuilder
{
    /// <summary>
    /// Ensures default difference factors only (area + the four standard ones) — catalog factors
    /// are added from the UI when needed. Add via DbSet explicitly: adding via the navigation
    /// with pre-generated ids is treated by EF as updating missing rows (UPDATE hits 0 rows → 409).
    /// </summary>
    public static void EnsureDifferenceFactorLines(
        ValuationDbContext db,
        ValuationComparableSelection row)
    {
        var existing = row.AdjustmentLines
            .Select(l => l.FactorKey)
            .ToHashSet(StringComparer.Ordinal);
        var start = row.AdjustmentLines.Count == 0
            ? 10
            : row.AdjustmentLines.Max(l => l.SortOrder) + 1;
        var added = 0;
        foreach (var key in MarketAdjustmentFactorKeys.DefaultDifferenceFactors)
        {
            if (existing.Contains(key)) continue;
            db.ValuationComparableAdjustmentLines.Add(new ValuationComparableAdjustmentLine
            {
                Id = Guid.NewGuid(),
                SelectionId = row.Id,
                FactorKey = key,
                LabelAr = MarketAdjustmentFactorKeys.DefaultLabelAr(key),
                Percent = 0m,
                Rationale = "",
                IsIncluded = true,
                SortOrder = start + added,
            });
            added++;
        }
    }

    public static ValuationComparableSelectionListDto BuildList(
        ValuationRequest request,
        IReadOnlyList<ValuationComparableSelection> rows,
        IReadOnlyDictionary<Guid, ComparableProperty> comps,
        DateOnly valuationDate,
        ValuationMarketApproach? header,
        string selectionContext,
        IReadOnlyList<ValuationAdjustmentFactorRationale> factorRationales)
    {
        var adoptedRows = rows.Where(r => r.IsAdopted).ToList();
        var subjectAreaForSuggestion = header?.SubjectAreaSqm ?? 0m;
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

        // Comparable weights from difference-factor sum only (areaAdj + Σ) — not sequential adjustments.
        var factorsSums = adoptedRows
            .Select(r =>
            {
                if (!comps.TryGetValue(r.ComparablePropertyId, out var comp))
                    return 0m;
                var areaAdj = AreaAdjustmentRules.SuggestPct(
                    areaMethod,
                    subjectAreaForSuggestion,
                    EffectiveCompValues(r, comp).Area,
                    areaFactor);
                var otherDiff = MarketApproachRules.SumIncludedPercents(
                    r.AdjustmentLines
                        .Where(l =>
                            l.IsIncluded
                            && MarketAdjustmentFactorKeys.IsDifferenceFactor(l.FactorKey)
                            && l.FactorKey != MarketAdjustmentFactorKeys.Area)
                        .Select(l => l.Percent));
                return areaAdj + otherDiff;
            })
            .ToList();
        // Interactive model spec: automatic suggestion as-is (5% units); manual override replaces
        // one row only; sum ≠ 100% shows an alert the valuer resolves themselves.
        var suggested = MarketApproachRules.SuggestWeights(factorsSums);
        var basis = MarketAdjustmentBasisKeys.Normalize(header?.AdjustmentBasis);

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
        var area = header?.SubjectAreaSqm;
        var roundDecimals = header?.ValueRoundDecimals
            ?? MarketApproachRules.DefaultValueRoundDecimals;
 // : whole-property basis yields the opinion directly — "without multiplying by area".
        // Cost logic §3: approach output is raw without rounding — round once after reconciliation.
        var opinionRaw = basis == MarketAdjustmentBasisKeys.WholeProperty
            ? weighted
            : area is > 0m
                ? MarketOpinionRules.ComputeOpinionValue(weighted, area.Value)
                : 0m;
        var opinion = opinionRaw;

        return new ValuationComparableSelectionListDto
        {
            ValuationRequestId = request.Id,
            PropertyId = request.PropertyId,
            SelectionContext = ComparableSelectionContexts.Normalize(selectionContext),
            AdoptedCount = adoptedRows.Count,
            MeetsMinimumAdoptedGate = ValuationComparableSelectionRules.MeetsMinimumAdopted(
                rows.Select(r => r.IsAdopted)),
            WeightsSumTo100 = adoptedRows.Count == 0
                || MarketApproachRules.WeightsSumTo100(effectiveWeights),
            WeightedPricePerSqm = weighted,
            SubjectAreaSqm = area,
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
        var areaAdj = AreaAdjustmentRules.SuggestPct(
            areaMethod, subjectAreaSqm, eff.Area, areaFactorPct);
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
                    // "Suggested until overridden": comparable kind without an entered % shows the default as suggested.
                    var isSuggested =
                        l.FactorKey == MarketAdjustmentFactorKeys.TransactionType
                        && l.Percent == 0m;
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
                        IsSuggestedValue = isSuggested,
                    };
                })
                .ToList(),
            SumSequentialPct = MarketApproachRules.SumIncludedPercents(sequentialPct),
            SumDifferencePct = diffSum,
            SumIncludedPct = sumAll,
            ExceedsLargeAdjustmentThreshold =
                MarketApproachRules.ExceedsLargeAdjustmentThreshold(diffSum),
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
