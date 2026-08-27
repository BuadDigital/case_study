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
        CancellationToken cancellationToken = default) =>
        await ListAsync(
            valuationRequestId,
            ComparableSelectionContexts.Market,
            cancellationToken);

    public async Task<ValuationComparableSelectionListDto?> ListAsync(
        Guid valuationRequestId,
        string selectionContext,
        CancellationToken cancellationToken = default)
    {
        var request = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (request is null) return null;

        var context = ComparableSelectionContexts.Normalize(selectionContext);
        if (context == ComparableSelectionContexts.Market)
        {
            // مقارنات روابط العقار وبذرة النموذج التفاعلي تتعايشان في البنك —
            // البذرة لا تُحذف عند الاستيراد (بيانات النموذج هي مرجع العرض التجريبي).
            await ImportPropertyLinkedComparablesAsync(request, cancellationToken);
            await ComparableBankSeed.EnsureForValuationRequestAsync(
                db, valuationRequestId, cancellationToken);
        }

        var rows = await db.ValuationComparableSelections.AsNoTracking()
            .Include(x => x.AdjustmentLines)
            .Where(x =>
                x.ValuationRequestId == valuationRequestId
                && x.SelectionContext == context)
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
        return BuildList(request, rows, comps, today, header, context);
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

        var context = ComparableSelectionContexts.Normalize(request.SelectionContext);
        var existing = await db.ValuationComparableSelections
            .Where(x =>
                x.ValuationRequestId == valuationRequestId
                && x.SelectionContext == context)
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
                SelectionContext = context,
                SortOrder = i,
                IsAdopted = it.IsAdopted,
                SelectedByUserId = selectedByUserId,
                SelectedAtUtc = now,
            });
            foreach (var line in MarketApproachRules.CreateStandardMarketLines(selectionId))
                db.ValuationComparableAdjustmentLines.Add(line);
        }

        await EnsureMarketApproachHeaderAsync(valuationRequestId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (await ListAsync(valuationRequestId, context, cancellationToken), null);
    }

    public async Task<(ValuationComparableSelectionDto? Result, string? Error)> SetAdoptedAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        bool isAdopted,
        string selectedByUserId,
        CancellationToken cancellationToken = default,
        string? selectionContext = null)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, "طلب التقييم غير موجود");
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات");

        var context = ComparableSelectionContexts.Normalize(selectionContext);
        var row = await db.ValuationComparableSelections
            .Include(x => x.AdjustmentLines)
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId
                    && x.ComparablePropertyId == comparablePropertyId
                    && x.SelectionContext == context,
                cancellationToken);

        var now = _time.UtcNow();
        if (row is null)
        {
            var comp = await db.ComparableProperties.AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.Id == comparablePropertyId && c.IsActive,
                    cancellationToken);
            if (comp is null) return (null, "المقارن غير موجود أو معطّل");

            var maxOrder = await db.ValuationComparableSelections
                .Where(x =>
                    x.ValuationRequestId == valuationRequestId
                    && x.SelectionContext == context)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync(cancellationToken) ?? -1;

            var selectionId = Guid.NewGuid();
            row = new ValuationComparableSelection
            {
                Id = selectionId,
                ValuationRequestId = valuationRequestId,
                ComparablePropertyId = comparablePropertyId,
                SelectionContext = context,
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
                EnsureDifferenceFactorLines(db, row);
            }
        }

        await EnsureMarketApproachHeaderAsync(valuationRequestId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    public async Task<(bool Ok, string? Error)> RemoveAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default,
        string? selectionContext = null)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (false, "طلب التقييم غير موجود");
        if (vr.Status == ValuationRequestStatus.Done)
            return (false, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات");

        var context = ComparableSelectionContexts.Normalize(selectionContext);
        var row = await db.ValuationComparableSelections
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId
                    && x.ComparablePropertyId == comparablePropertyId
                    && x.SelectionContext == context,
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

        // مواصفة النموذج التفاعلي: «المنع يقع عند الاعتماد فقط — الإدخال الجزئي محفوظ كمسوّدة».
        // المبررات تُطالب بها بوابات الإصدار والتنبيهات المنهجية، لا الحفظ.
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

            if (line.Percent is < -100m or > 100m)
                errors[$"adjustmentLines[{i}].percent"] = "النسبة يجب أن تكون بين -100 و 100";
        }

        if (request.WeightIsManual)
        {
            if (request.WeightPct is null)
                errors["weightPct"] = "الوزن اليدوي مطلوب";
            else if (request.WeightPct is < 0m or > 100m)
                errors["weightPct"] = "الوزن يجب أن يكون بين 0 و 100";
        }

        if (request.PriceOverrideSar is < 0m)
            errors["priceOverrideSar"] = "سعر العقار يجب أن يكون ≥ 0";
        if (request.AreaOverrideSqm is <= 0m)
            errors["areaOverrideSqm"] = "مساحة المقارن يجب أن تكون أكبر من صفر";

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
                // العوامل المعرَّفة تحمل تسميتها القياسية دائماً — تسمية العميل تُقبل
                // للعامل المخصص فقط (تحصين ضد تسميات مشوّهة الترميز).
                LabelAr = key != MarketAdjustmentFactorKeys.Custom
                          && MarketAdjustmentFactorKeys.IsKnown(key)
                    ? MarketAdjustmentFactorKeys.DefaultLabelAr(key)
                    : string.IsNullOrWhiteSpace(line.LabelAr)
                        ? MarketAdjustmentFactorKeys.DefaultLabelAr(key)
                        : line.LabelAr.Trim(),
                Percent = line.Percent,
                Rationale = line.Rationale?.Trim() ?? "",
                DescriptionAr = string.IsNullOrWhiteSpace(line.DescriptionAr)
                    ? null
                    : line.DescriptionAr.Trim(),
                IsIncluded = line.IsIncluded,
                SortOrder = line.SortOrder != 0 ? line.SortOrder : i,
            });
        }

        row.WeightIsManual = request.WeightIsManual;
        row.WeightPct = request.WeightIsManual ? request.WeightPct : null;
        row.WeightOverrideRationale = request.WeightIsManual
            ? request.WeightOverrideRationale?.Trim()
            : null;
        row.PriceOverrideSar = request.PriceOverrideSar;
        row.AreaOverrideSqm = request.AreaOverrideSqm;
        if (request.AreaAdjustmentMethod is not null)
            row.AreaAdjustmentMethod = AreaAdjustmentMethods.Normalize(request.AreaAdjustmentMethod);

        await db.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    /// <summary>
    /// يضمن عوامل الاختلاف الافتراضية فقط (المساحة + الأربعة القياسية) — عوامل الكتالوج
    /// تُضاف من الواجهة عند الحاجة. الإضافة عبر DbSet صراحةً: الإضافة عبر مجموعة التنقّل
    /// بمعرّفات مولّدة مسبقاً يعتبرها EF تعديلاً لصفوف غير موجودة (UPDATE يصيب صفر صفوف → 409).
    /// </summary>
    private static void EnsureDifferenceFactorLines(
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
            .Where(x =>
                x.ValuationRequestId == row.ValuationRequestId
                && x.SelectionContext == row.SelectionContext)
            .ToListAsync(cancellationToken);
        var comps = await db.ComparableProperties.AsNoTracking()
            .Where(c => all.Select(a => a.ComparablePropertyId).Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, cancellationToken);

        var list = BuildList(
            request,
            all,
            comps,
            DateOnly.FromDateTime(_time.UtcNow()),
            await db.ValuationMarketApproaches.AsNoTracking()
                .FirstOrDefaultAsync(x => x.ValuationRequestId == row.ValuationRequestId, cancellationToken),
            row.SelectionContext);
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
            var org = await organizationSettings.GetInternalAsync(cancellationToken);
            header = new ValuationMarketApproach
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
                AreaFactorPct = org.Valuation.AreaFactorPct > 0
                    ? org.Valuation.AreaFactorPct
                    : AreaAdjustmentRules.DefaultAreaFactorPct,
                AnnualMarketRatePct = org.Valuation.AnnualMarketRatePct >= 0
                    ? org.Valuation.AnnualMarketRatePct
                    : MarketApproachRules.DefaultAnnualMarketRatePct,
                ValueRoundDecimals = org.Valuation.MarketValueRoundDecimals is >= 0 and <= 6
                    ? org.Valuation.MarketValueRoundDecimals
                    : MarketApproachRules.DefaultValueRoundDecimals,
            };
            db.ValuationMarketApproaches.Add(header);
        }

        header.SubjectAreaSqm = request.SubjectAreaSqm;
        if (request.AdjustmentBasis is not null)
            header.AdjustmentBasis = MarketAdjustmentBasisKeys.Normalize(request.AdjustmentBasis);
        if (request.AreaFactorPct is >= 0.1m and <= 50m)
            header.AreaFactorPct = request.AreaFactorPct.Value;
        if (request.AnnualMarketRatePct is >= 0m and <= 50m)
            header.AnnualMarketRatePct = request.AnnualMarketRatePct.Value;
        if (request.ValueRoundDecimals is >= 0 and <= 6)
            header.ValueRoundDecimals = request.ValueRoundDecimals.Value;
        header.AnalysisNotes = string.IsNullOrWhiteSpace(request.AnalysisNotes)
            ? null
            : request.AnalysisNotes.Trim();
        if (request.SubjectSpecs is not null)
            header.SubjectSpecJson = SerializeSubjectSpecs(request.SubjectSpecs);
        header.UpdatedAtUtc = _time.UtcNow();
        await db.SaveChangesAsync(cancellationToken);
        return (await ListAsync(valuationRequestId, cancellationToken), null);
    }

    private static ValuationComparableSelectionListDto BuildList(
        ValuationRequest request,
        IReadOnlyList<ValuationComparableSelection> rows,
        IReadOnlyDictionary<Guid, ComparableProperty> comps,
        DateOnly valuationDate,
        ValuationMarketApproach? header,
        string selectionContext)
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

        // أوزان المقارنات من مجموع عوامل الاختلاف فقط (areaAdj + Σ) — لا التسويات التسلسلية.
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
        // مواصفة النموذج التفاعلي: الاقتراح الآلي كما هو (وحدات ٥٪)؛ التجاوز اليدوي يحل محل
        // صف واحد فقط، واختلال المجموع عن ١٠٠٪ يظهر تنبيهاً يعالجه المقيّم بنفسه.
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
 // : whole-property basis yields the opinion directly — «دون ضرب في المساحة».
        // منطق-التكلفة §٣: مخرج الأسلوب خام بلا تقريب — التقريب مرة واحدة بعد التوفيق.
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
            Items = items,
        };
    }

 /// <summary>compEdit: القيم الفعلية للمقارن بعد تجاوزات هذا التقييم — سعر المتر = الإجمالي ÷ المساحة.</summary>
    private static (decimal Total, decimal Area, decimal Unit) EffectiveCompValues(
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

    private static readonly System.Text.Json.JsonSerializerOptions SubjectSpecJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static IReadOnlyDictionary<string, string> ParseSubjectSpecs(string? json)
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

    private static string? SerializeSubjectSpecs(IReadOnlyDictionary<string, string>? specs)
    {
        if (specs is null) return null;
        var clean = specs
            .Where(kv => !string.IsNullOrWhiteSpace(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
            .ToDictionary(kv => kv.Key.Trim(), kv => kv.Value.Trim(), StringComparer.Ordinal);
        return clean.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(clean, SubjectSpecJsonOptions);
    }

    private async Task<bool> ImportPropertyLinkedComparablesAsync(
        ValuationRequest request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.PropertyId, out var propertyId) || propertyId == Guid.Empty)
            return false;

        var links = await db.PropertyComparableLinks.AsNoTracking()
            .Where(x => x.PropertyId == propertyId)
            .OrderBy(x => x.LinkedAtUtc)
            .Select(x => x.ComparablePropertyId)
            .ToListAsync(cancellationToken);
        if (links.Count == 0) return false;

        var existing = (await db.ValuationComparableSelections
            .Where(x =>
                x.ValuationRequestId == request.Id
                && x.SelectionContext == ComparableSelectionContexts.Market)
            .Select(x => x.ComparablePropertyId)
            .ToListAsync(cancellationToken))
            .ToHashSet();

        var missing = links.Where(id => !existing.Contains(id)).Distinct().ToList();
        if (missing.Count == 0) return true;

        var activeIds = (await db.ComparableProperties.AsNoTracking()
            .Where(c => missing.Contains(c.Id) && c.IsActive)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken)).ToHashSet();

        var maxOrder = await db.ValuationComparableSelections
            .Where(x =>
                x.ValuationRequestId == request.Id
                && x.SelectionContext == ComparableSelectionContexts.Market)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken) ?? -1;

        var now = _time.UtcNow();
        var added = false;
        foreach (var comparableId in missing)
        {
            if (!activeIds.Contains(comparableId)) continue;
            var selectionId = Guid.NewGuid();
            db.ValuationComparableSelections.Add(new ValuationComparableSelection
            {
                Id = selectionId,
                ValuationRequestId = request.Id,
                ComparablePropertyId = comparableId,
                SelectionContext = ComparableSelectionContexts.Market,
                SortOrder = ++maxOrder,
                IsAdopted = true,
                SelectedAtUtc = now,
            });
            foreach (var line in MarketApproachRules.CreateStandardMarketLines(selectionId))
                db.ValuationComparableAdjustmentLines.Add(line);
            added = true;
        }

        if (!added) return true;

        await EnsureMarketApproachHeaderAsync(request.Id, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task EnsureMarketApproachHeaderAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        var exists = await db.ValuationMarketApproaches
            .AnyAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        if (exists) return;

        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        db.ValuationMarketApproaches.Add(new ValuationMarketApproach
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = valuationRequestId,
            AreaFactorPct = org.Valuation.AreaFactorPct > 0
                ? org.Valuation.AreaFactorPct
                : AreaAdjustmentRules.DefaultAreaFactorPct,
            AnnualMarketRatePct = org.Valuation.AnnualMarketRatePct >= 0
                ? org.Valuation.AnnualMarketRatePct
                : MarketApproachRules.DefaultAnnualMarketRatePct,
            ValueRoundDecimals = org.Valuation.MarketValueRoundDecimals is >= 0 and <= 6
                ? org.Valuation.MarketValueRoundDecimals
                : MarketApproachRules.DefaultValueRoundDecimals,
            UpdatedAtUtc = _time.UtcNow(),
        });
    }

    private static ValuationComparableMarketDto BuildMarket(
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

 // : the chain runs on the whole deal price or the unit rate per the basis (بعد تجاوزات compEdit).
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
                    // «مقترح حتى يُتجاوز»: نوع المقارن بلا نسبة مدخلة يعرض الافتراضي بأسلوب مقترح.
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
