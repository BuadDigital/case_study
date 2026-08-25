using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Select / adopt bank comps + sequential market adjustments / weights.
/// Full difference-factor matrix comes later.
/// </summary>
public sealed class ValuationComparableSelectionService(
    ValuationDbContext db,
    IOrganizationSettingsService organizationSettings,
    TimeProvider? time = null)
    : IValuationComparableSelectionService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationComparableSelectionListDto?> ListAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var request = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (request is null) return null;

        var rows = await db.ValuationComparableSelections.AsNoTracking()
            .Include(x => x.AdjustmentLines)
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.SelectedAtUtc)
            .ToListAsync(cancellationToken);

        var compIds = rows.Select(r => r.ComparablePropertyId).Distinct().ToList();
        var comps = await db.ComparableProperties.AsNoTracking()
            .Where(c => compIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, cancellationToken);

        var today = DateOnly.FromDateTime(_time.UtcNow());
        var header = await db.ValuationMarketApproaches.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        return BuildList(request, rows, comps, today, header);
    }

    public async Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)>
        ReplaceAsync(
            Guid valuationRequestId,
            ReplaceValuationComparableSelectionsRequest request,
            string selectedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });

        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل — لا يمكن تعديل المقارنات" });

        var items = request.Items ?? [];
        var seen = new HashSet<Guid>();
        var errors = new Dictionary<string, string>();
        for (var i = 0; i < items.Count; i++)
        {
            var id = items[i].ComparablePropertyId;
            if (id == Guid.Empty)
            {
                errors[$"items[{i}].comparablePropertyId"] = "معرّف المقارن مطلوب";
                continue;
            }

            if (!seen.Add(id))
                errors[$"items[{i}].comparablePropertyId"] = "مقارن مكرر في القائمة";
        }

        if (errors.Count > 0) return (null, errors);

        var ids = seen.ToList();
        var activeComps = await db.ComparableProperties.AsNoTracking()
            .Where(c => ids.Contains(c.Id) && c.IsActive)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);
        var activeSet = activeComps.ToHashSet();
        foreach (var id in ids)
        {
            if (!activeSet.Contains(id))
                errors[id.ToString()] = "المقارن غير موجود أو معطّل";
        }

        if (errors.Count > 0) return (null, errors);

        var existing = await db.ValuationComparableSelections
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .ToListAsync(cancellationToken);
        db.ValuationComparableSelections.RemoveRange(existing);

        var now = _time.UtcNow();
        var ordered = items
            .Select((it, idx) => new { it, idx })
            .OrderBy(x => x.it.SortOrder)
            .ThenBy(x => x.idx)
            .ToList();

        for (var i = 0; i < ordered.Count; i++)
        {
            var it = ordered[i].it;
            var selectionId = Guid.NewGuid();
            db.ValuationComparableSelections.Add(new ValuationComparableSelection
            {
                Id = selectionId,
                ValuationRequestId = valuationRequestId,
                ComparablePropertyId = it.ComparablePropertyId,
                SortOrder = i,
                IsAdopted = it.IsAdopted,
                SelectedByUserId = selectedByUserId,
                SelectedAtUtc = now,
            });
            foreach (var line in MarketApproachRules.CreateStandardMarketLines(selectionId))
                db.ValuationComparableAdjustmentLines.Add(line);
        }

        await db.SaveChangesAsync(cancellationToken);
        return (await ListAsync(valuationRequestId, cancellationToken), null);
    }

    public async Task<(ValuationComparableSelectionDto? Result, string? Error)> SetAdoptedAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        bool isAdopted,
        string selectedByUserId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, "طلب التقييم غير موجود");
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات");

        var row = await db.ValuationComparableSelections
            .Include(x => x.AdjustmentLines)
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId
                    && x.ComparablePropertyId == comparablePropertyId,
                cancellationToken);

        if (isAdopted)
        {
 // اعتماد انتقائي بحد أقصى قابل للضبط.
            var settings = await organizationSettings.GetInternalAsync(cancellationToken);
            var cap = Math.Max(1, settings.Valuation.MaxAdoptedComparables);
            var adoptedOthers = await db.ValuationComparableSelections
                .CountAsync(
                    x => x.ValuationRequestId == valuationRequestId
                        && x.IsAdopted
                        && x.ComparablePropertyId != comparablePropertyId,
                    cancellationToken);
            if (adoptedOthers >= cap)
                return (null, $"بلغت الحد الأقصى للمقارنات المعتمدة ({cap}) — عدّله من إعدادات المؤسسة أو ألغِ اعتماد مقارن آخر");
        }

        var now = _time.UtcNow();
        if (row is null)
        {
            var comp = await db.ComparableProperties.AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.Id == comparablePropertyId && c.IsActive,
                    cancellationToken);
            if (comp is null) return (null, "المقارن غير موجود أو معطّل");

            var maxOrder = await db.ValuationComparableSelections
                .Where(x => x.ValuationRequestId == valuationRequestId)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(cancellationToken) ?? -1;

            var selectionId = Guid.NewGuid();
            row = new ValuationComparableSelection
            {
                Id = selectionId,
                ValuationRequestId = valuationRequestId,
                ComparablePropertyId = comparablePropertyId,
                SortOrder = maxOrder + 1,
                IsAdopted = isAdopted,
                SelectedByUserId = selectedByUserId,
                SelectedAtUtc = now,
            };
            db.ValuationComparableSelections.Add(row);
            foreach (var line in MarketApproachRules.CreateStandardMarketLines(selectionId))
                db.ValuationComparableAdjustmentLines.Add(line);
        }
        else
        {
            row.IsAdopted = isAdopted;
            row.SelectedByUserId = selectedByUserId;
            row.SelectedAtUtc = now;
            if (row.AdjustmentLines.Count == 0)
            {
                foreach (var line in MarketApproachRules.CreateStandardMarketLines(row.Id))
                    db.ValuationComparableAdjustmentLines.Add(line);
            }
            else
            {
                EnsureDifferenceFactorLines(row);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    public async Task<(bool Ok, string? Error)> RemoveAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (false, "طلب التقييم غير موجود");
        if (vr.Status == ValuationRequestStatus.Done)
            return (false, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات");

        var row = await db.ValuationComparableSelections
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId
                    && x.ComparablePropertyId == comparablePropertyId,
                cancellationToken);
        if (row is null) return (false, "المقارن غير مختار");

        db.ValuationComparableSelections.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(ValuationComparableSelectionDto? Result, Dictionary<string, string>? Errors)>
        SaveMarketAsync(
            Guid valuationRequestId,
            Guid selectionId,
            SaveValuationComparableMarketRequest request,
            CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل — لا يمكن تعديل التسويات" });

        var row = await db.ValuationComparableSelections
            .Include(x => x.AdjustmentLines)
            .FirstOrDefaultAsync(
                x => x.Id == selectionId && x.ValuationRequestId == valuationRequestId,
                cancellationToken);
        if (row is null)
            return (null, new Dictionary<string, string> { ["_"] = "الاختيار غير موجود" });

 // صلاحية تحرير التسويات (ب-2 §13): absent row = unlocked, matching the defaults.
        var approachSettings = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        if (approachSettings is { AdjustmentsEditUnlocked: false })
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "صلاحية تحرير التسويات معطَّلة — تُفعَّل من إعدادات التقييم (شاشة 1)",
            });
        }

        var lines = request.AdjustmentLines ?? [];
        var errors = new Dictionary<string, string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!MarketAdjustmentFactorKeys.IsKnown(line.FactorKey))
                errors[$"adjustmentLines[{i}].factorKey"] = "عامل تسوية غير معروف";

            if (line.FactorKey == MarketAdjustmentFactorKeys.Custom
                && string.IsNullOrWhiteSpace(line.LabelAr))
                errors[$"adjustmentLines[{i}].labelAr"] = "تسمية العامل المضاف مطلوبة";

            if (MarketApproachRules.RequiresRationale(line.Percent, line.IsIncluded)
                && string.IsNullOrWhiteSpace(line.Rationale))
                errors[$"adjustmentLines[{i}].rationale"] = "المبرر إلزامي عند نسبة غير صفرية";

            if (line.Percent is < -100m or > 100m)
                errors[$"adjustmentLines[{i}].percent"] = "النسبة يجب أن تكون بين -100 و 100";
        }

        if (request.WeightIsManual)
        {
            if (request.WeightPct is null)
                errors["weightPct"] = "الوزن اليدوي مطلوب";
            else if (request.WeightPct is < 0m or > 100m)
                errors["weightPct"] = "الوزن يجب أن يكون بين 0 و 100";
 // Overriding the suggestion needs a written rationale.
            if (string.IsNullOrWhiteSpace(request.WeightOverrideRationale))
                errors["weightOverrideRationale"] = "مبرر تجاوز الوزن الآلي إلزامي";
        }

        if (request.AreaAdjustmentMethod is not null
            && !AreaAdjustmentMethods.IsKnown(request.AreaAdjustmentMethod))
        {
            errors["areaAdjustmentMethod"] = "طريقة قياس تسوية المساحة غير معروفة";
        }

        if (errors.Count > 0) return (null, errors);

        db.ValuationComparableAdjustmentLines.RemoveRange(row.AdjustmentLines);
        row.AdjustmentLines.Clear();

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var key = line.FactorKey.Trim();
            row.AdjustmentLines.Add(new ValuationComparableAdjustmentLine
            {
                Id = line.Id is { } existing && existing != Guid.Empty
                    ? existing
                    : Guid.NewGuid(),
                SelectionId = row.Id,
                FactorKey = key,
                LabelAr = string.IsNullOrWhiteSpace(line.LabelAr)
                    ? MarketAdjustmentFactorKeys.DefaultLabelAr(key)
                    : line.LabelAr.Trim(),
                Percent = line.Percent,
                Rationale = line.Rationale?.Trim() ?? "",
                IsIncluded = line.IsIncluded,
                SortOrder = line.SortOrder != 0 ? line.SortOrder : i,
            });
        }

        row.WeightIsManual = request.WeightIsManual;
        row.WeightPct = request.WeightIsManual ? request.WeightPct : null;
        row.WeightOverrideRationale = request.WeightIsManual
            ? request.WeightOverrideRationale?.Trim()
            : null;
        if (request.AreaAdjustmentMethod is not null)
            row.AreaAdjustmentMethod = AreaAdjustmentMethods.Normalize(request.AreaAdjustmentMethod);

        await db.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    private static void EnsureDifferenceFactorLines(ValuationComparableSelection row)
    {
        var existing = row.AdjustmentLines
            .Select(l => l.FactorKey)
            .ToHashSet(StringComparer.Ordinal);
        var start = row.AdjustmentLines.Count == 0
            ? 10
            : row.AdjustmentLines.Max(l => l.SortOrder) + 1;
        var added = 0;
        foreach (var key in MarketAdjustmentFactorKeys.StandardDifferenceFactors)
        {
            if (existing.Contains(key)) continue;
            row.AdjustmentLines.Add(new ValuationComparableAdjustmentLine
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

    private async Task<ValuationComparableSelectionDto?> GetSelectionDtoAsync(
        Guid selectionId,
        CancellationToken cancellationToken)
    {
        var row = await db.ValuationComparableSelections.AsNoTracking()
            .Include(x => x.AdjustmentLines)
            .FirstOrDefaultAsync(x => x.Id == selectionId, cancellationToken);
        if (row is null) return null;

        var request = await db.ValuationRequests.AsNoTracking()
            .FirstAsync(x => x.Id == row.ValuationRequestId, cancellationToken);
        var all = await db.ValuationComparableSelections.AsNoTracking()
            .Include(x => x.AdjustmentLines)
            .Where(x => x.ValuationRequestId == row.ValuationRequestId)
            .ToListAsync(cancellationToken);
        var comps = await db.ComparableProperties.AsNoTracking()
            .Where(c => all.Select(a => a.ComparablePropertyId).Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, cancellationToken);

        var list = BuildList(
            request,
            all,
            comps,
            DateOnly.FromDateTime(_time.UtcNow()),
            await db.ValuationMarketApproaches.AsNoTracking().FirstOrDefaultAsync(x => x.ValuationRequestId == row.ValuationRequestId, cancellationToken));
        return list.Items.FirstOrDefault(i => i.Id == selectionId);
    }

    public async Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)>
        SaveMarketApproachAsync(
            Guid valuationRequestId,
            SaveValuationMarketApproachRequest request,
            CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });

        if (request.SubjectAreaSqm is < 0m)
            return (null, new Dictionary<string, string> { ["subjectAreaSqm"] = "المساحة يجب أن تكون ≥ 0" });
        if (request.AdjustmentBasis is not null && !MarketAdjustmentBasisKeys.IsKnown(request.AdjustmentBasis))
            return (null, new Dictionary<string, string> { ["adjustmentBasis"] = "أساس التسويات غير معروف" });

        var header = await db.ValuationMarketApproaches
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        if (header is null)
        {
            header = new ValuationMarketApproach
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            db.ValuationMarketApproaches.Add(header);
        }

        header.SubjectAreaSqm = request.SubjectAreaSqm;
        if (request.AdjustmentBasis is not null)
            header.AdjustmentBasis = MarketAdjustmentBasisKeys.Normalize(request.AdjustmentBasis);
        header.AnalysisNotes = string.IsNullOrWhiteSpace(request.AnalysisNotes)
            ? null
            : request.AnalysisNotes.Trim();
        header.UpdatedAtUtc = _time.UtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return (await ListAsync(valuationRequestId, cancellationToken), null);
    }

    private static ValuationComparableSelectionListDto BuildList(
        ValuationRequest request,
        IReadOnlyList<ValuationComparableSelection> rows,
        IReadOnlyDictionary<Guid, ComparableProperty> comps,
        DateOnly valuationDate,
        ValuationMarketApproach? header)
    {
        var adoptedRows = rows.Where(r => r.IsAdopted).ToList();
        var sums = adoptedRows
            .Select(r => MarketApproachRules.SumIncludedPercents(
                r.AdjustmentLines.Where(l => l.IsIncluded).Select(l => l.Percent)))
            .ToList();
        // raw suggestions, then renormalized around manual overrides:
        // partial overrides keep the total at 100 instead of blocking issuance.
        var suggested = MarketApproachRules.RenormalizeSuggestions(
            MarketApproachRules.SuggestWeights(sums),
            adoptedRows.Select(r => r.WeightIsManual && r.WeightPct is not null).ToList(),
            adoptedRows.Select(r => r.WeightPct ?? 0m).ToList());
        var basis = MarketAdjustmentBasisKeys.Normalize(header?.AdjustmentBasis);
        var subjectAreaForSuggestion = header?.SubjectAreaSqm ?? 0m;

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

            var market = BuildMarket(row, comp, valuationDate, suggestedForRow, basis, subjectAreaForSuggestion);
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
            });

            if (row.IsAdopted)
                weightPairs.Add((market.PricePerSqmAfterDifference, market.EffectiveWeightPct));
        }

        var effectiveWeights = weightPairs.Select(p => p.weight).ToList();
        var weighted = MarketApproachRules.WeightedUnitRate(weightPairs);
        var area = header?.SubjectAreaSqm;
 // : whole-property basis yields the opinion directly — «دون ضرب في المساحة».
        var opinion = basis == MarketAdjustmentBasisKeys.WholeProperty
            ? weighted
            : area is > 0m
                ? MarketOpinionRules.ComputeOpinionValue(weighted, area.Value)
                : 0m;

        return new ValuationComparableSelectionListDto
        {
            ValuationRequestId = request.Id,
            PropertyId = request.PropertyId,
            AdoptedCount = adoptedRows.Count,
            MeetsMinimumAdoptedGate = ValuationComparableSelectionRules.MeetsMinimumAdopted(
                rows.Select(r => r.IsAdopted)),
            WeightsSumTo100 = adoptedRows.Count == 0
                || MarketApproachRules.WeightsSumTo100(effectiveWeights),
            WeightedPricePerSqm = weighted,
            SubjectAreaSqm = area,
            AdjustmentBasis = basis,
            AdjustmentBasisLabelAr = MarketAdjustmentBasisKeys.LabelAr(basis),
            MarketOpinionValue = opinion,
            AnalysisNotes = header?.AnalysisNotes,
            Items = items,
        };
    }

    private static ValuationComparableMarketDto BuildMarket(
        ValuationComparableSelection row,
        ComparableProperty comp,
        DateOnly valuationDate,
        decimal? suggestedWeightPct,
        string adjustmentBasis,
        decimal subjectAreaSqm)
    {
        var ordered = row.AdjustmentLines.OrderBy(l => l.SortOrder).ToList();
        var sequentialPct = ordered
            .Where(l => l.IsIncluded && MarketAdjustmentFactorKeys.IsSequential(l.FactorKey))
            .Select(l => l.Percent)
            .ToList();
        var differencePct = ordered
            .Where(l => l.IsIncluded && MarketAdjustmentFactorKeys.IsDifferenceFactor(l.FactorKey))
            .Select(l => l.Percent)
            .ToList();

 // : the chain runs on the whole deal price or the unit rate per the basis.
        var baseAmount = adjustmentBasis == MarketAdjustmentBasisKeys.WholeProperty
            ? comp.Price
            : comp.PricePerSqm;
        var (afterSeq, diffSum, afterDiff) = MarketApproachRules.ApplyMarketUnitRate(
            baseAmount,
            sequentialPct,
            differencePct);
        var sumAll = MarketApproachRules.SumIncludedPercents(
            ordered.Where(l => l.IsIncluded).Select(l => l.Percent));
        var suggested = suggestedWeightPct ?? 0m;
        var effective = row.WeightIsManual && row.WeightPct is not null
            ? row.WeightPct.Value
            : suggested;

        return new ValuationComparableMarketDto
        {
            AdjustmentLines = ordered
                .Select(l => new ValuationComparableAdjustmentLineDto
                {
                    Id = l.Id,
                    FactorKey = l.FactorKey,
                    LabelAr = l.LabelAr,
                    Percent = l.Percent,
                    Rationale = l.Rationale,
                    IsIncluded = l.IsIncluded,
                    SortOrder = l.SortOrder,
                })
                .ToList(),
            SumSequentialPct = MarketApproachRules.SumIncludedPercents(sequentialPct),
            SumDifferencePct = diffSum,
            SumIncludedPct = sumAll,
            ExceedsLargeAdjustmentThreshold =
                MarketApproachRules.ExceedsLargeAdjustmentThreshold(sumAll),
            DealAgeMonths = MarketApproachRules.DealAgeMonths(comp.TransactionDate, valuationDate),
            PricePerSqmAfterSequential = afterSeq,
            PricePerSqmAfterDifference = afterDiff,
            SuggestedWeightPct = suggested,
            EffectiveWeightPct = effective,
            WeightIsManual = row.WeightIsManual,
            WeightPct = row.WeightPct,
            WeightOverrideRationale = row.WeightOverrideRationale,
            AreaAdjustmentMethod = AreaAdjustmentMethods.Normalize(row.AreaAdjustmentMethod),
            SuggestedAreaAdjustmentPct = AreaAdjustmentRules.SuggestPct(
                row.AreaAdjustmentMethod, subjectAreaSqm, comp.AreaSqm),
        };
    }
}
