using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// Selecting and adopting bank comparables plus the sequential market adjustments and weights.
/// Persistence goes through <see cref="IValuationComparableSelectionRepository"/> and the ق-6
/// freeze through <see cref="IValuationReportFreezeGate"/>, so this file holds rules only -
/// no EF (solid-scorecard finding 1).
/// </summary>
public sealed class ValuationComparableSelectionService(
    IValuationComparableSelectionRepository repo,
    IValuationReportFreezeGate freeze,
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
        var request = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (request is null) return null;

        var context = ComparableSelectionContexts.Normalize(selectionContext);
        if (context == ComparableSelectionContexts.Market)
        {
            // Property-link comparables and interactive-model seed coexist in the bank —
            // the seed is not deleted on import (model data is the demo-display reference).
            await ImportPropertyLinkedComparablesAsync(request, cancellationToken);
            await repo.EnsureBankSeedAsync(valuationRequestId, cancellationToken);
        }

        var rows = await repo.ListSelectionsAsync(valuationRequestId, context, cancellationToken);

        var compIds = rows.Select(r => r.ComparablePropertyId).Distinct().ToList();
        var comps = await repo.GetComparablesAsync(compIds, cancellationToken);

        var today = DateOnly.FromDateTime(_time.UtcNow());
        var header = await repo.GetMarketApproachAsync(valuationRequestId, cancellationToken);
        var factorRationales = await repo.ListFactorRationalesAsync(
            valuationRequestId, context, cancellationToken);
        return ValuationComparableListBuilder.BuildList(
            request, rows, comps, today, header, context, factorRationales);
    }

 /// <summary>
 /// Q-8-1: save the single adjustment-factor rationale (covers all comparables) — empty clears it,
 /// and non-empty is subject to the minimum length (Q-8-2).
 /// </summary>
    public async Task<(ValuationAdjustmentFactorRationaleDto? Result, Dictionary<string, string>? Errors)>
        SaveFactorRationaleAsync(
            Guid valuationRequestId,
            SaveAdjustmentFactorRationaleRequest request,
            string? updatedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل — لا يمكن تعديل المبررات" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = ValuationReportFreezeRules.FrozenMessageAr });
        }

        var approachSettings = await repo.GetApproachSettingsAsync(
            valuationRequestId, cancellationToken);
        if (approachSettings is { AdjustmentsEditUnlocked: false })
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "صلاحية تحرير التسويات معطَّلة — تُفعَّل من إعدادات التقييم (شاشة 1)",
            });
        }

        var context = ComparableSelectionContexts.Normalize(request.SelectionContext);
        var factorKey = request.FactorKey.Trim();
        if (factorKey.Length == 0)
            return (null, new Dictionary<string, string> { ["factorKey"] = "مفتاح العامل مطلوب" });

        var rationale = request.RationaleAr?.Trim() ?? "";
        if (JustificationRules.IsTooShort(rationale))
        {
            return (null, new Dictionary<string, string>
            {
                ["rationaleAr"] = JustificationRules.TooShortMessageAr("مبرر التسوية"),
            });
        }

        var row = await repo.FindFactorRationaleAsync(
            valuationRequestId, context, factorKey, cancellationToken);

        if (rationale.Length == 0)
        {
            if (row is not null)
            {
                await repo.RemoveFactorRationaleAsync(row, cancellationToken);
                await repo.SaveChangesAsync(cancellationToken);
            }

            return (new ValuationAdjustmentFactorRationaleDto
            {
                SelectionContext = context,
                FactorKey = factorKey,
                RationaleAr = "",
            }, null);
        }

        if (row is null)
        {
            row = new ValuationAdjustmentFactorRationale
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
                SelectionContext = context,
                FactorKey = factorKey,
            };
            await repo.AddFactorRationaleAsync(row, cancellationToken);
        }

        row.RationaleAr = rationale;
        row.UpdatedAtUtc = _time.UtcNow();
        row.UpdatedByUserId = updatedByUserId;
        await repo.SaveChangesAsync(cancellationToken);

        return (new ValuationAdjustmentFactorRationaleDto
        {
            SelectionContext = context,
            FactorKey = factorKey,
            RationaleAr = rationale,
        }, null);
    }

    public async Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)>
        ReplaceAsync(
            Guid valuationRequestId,
            ReplaceValuationComparableSelectionsRequest request,
            string selectedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });

        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل — لا يمكن تعديل المقارنات" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = ValuationReportFreezeRules.FrozenMessageAr });
        }

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
        var activeComps = await repo.ListActiveComparableIdsAsync(ids, cancellationToken);
        var activeSet = activeComps.ToHashSet();
        foreach (var id in ids)
        {
            if (!activeSet.Contains(id))
                errors[id.ToString()] = "المقارن غير موجود أو معطّل";
        }

        if (errors.Count > 0) return (null, errors);

        var context = ComparableSelectionContexts.Normalize(request.SelectionContext);
        var existing = await repo.FindSelectionsAsync(
            valuationRequestId, context, cancellationToken);
        await repo.RemoveSelectionsAsync(existing, cancellationToken);

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
            await repo.AddSelectionAsync(
                new ValuationComparableSelection
                {
                    Id = selectionId,
                    ValuationRequestId = valuationRequestId,
                    ComparablePropertyId = it.ComparablePropertyId,
                    SelectionContext = context,
                    SortOrder = i,
                    IsAdopted = it.IsAdopted,
                    SelectedByUserId = selectedByUserId,
                    SelectedAtUtc = now,
                },
                cancellationToken);
            await repo.AddAdjustmentLinesAsync(
                MarketApproachRules.CreateStandardMarketLines(selectionId).ToList(),
                cancellationToken);
        }

        await EnsureMarketApproachHeaderAsync(valuationRequestId, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);
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
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return (null, "طلب التقييم غير موجود");
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات");
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
            return (null, ValuationReportFreezeRules.FrozenMessageAr);

        var context = ComparableSelectionContexts.Normalize(selectionContext);
        var row = await repo.FindSelectionByComparableAsync(
            valuationRequestId, comparablePropertyId, context, includeLines: true, cancellationToken);

        var now = _time.UtcNow();
        if (row is null)
        {
            var comp = await repo.GetActiveComparableAsync(comparablePropertyId, cancellationToken);
            if (comp is null) return (null, "المقارن غير موجود أو معطّل");

            var maxOrder = await repo.MaxSortOrderAsync(
                valuationRequestId, context, cancellationToken);

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
            await repo.AddSelectionAsync(row, cancellationToken);
            await repo.AddAdjustmentLinesAsync(
                MarketApproachRules.CreateStandardMarketLines(selectionId).ToList(),
                cancellationToken);
        }
        else
        {
            row.IsAdopted = isAdopted;
            row.SelectedByUserId = selectedByUserId;
            row.SelectedAtUtc = now;
            await repo.AddAdjustmentLinesAsync(
                row.AdjustmentLines.Count == 0
                    ? MarketApproachRules.CreateStandardMarketLines(row.Id).ToList()
                    : ValuationComparableListBuilder.MissingDifferenceFactorLines(row),
                cancellationToken);
        }

        await EnsureMarketApproachHeaderAsync(valuationRequestId, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    public async Task<(bool Ok, string? Error)> RemoveAsync(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        CancellationToken cancellationToken = default,
        string? selectionContext = null)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return (false, "طلب التقييم غير موجود");
        if (vr.Status == ValuationRequestStatus.Done)
            return (false, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات");
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
            return (false, ValuationReportFreezeRules.FrozenMessageAr);

        var context = ComparableSelectionContexts.Normalize(selectionContext);
        var row = await repo.FindSelectionByComparableAsync(
            valuationRequestId, comparablePropertyId, context, includeLines: false, cancellationToken);
        if (row is null) return (false, "المقارن غير مختار");

        await repo.RemoveSelectionAsync(row, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public async Task<(ValuationComparableSelectionDto? Result, Dictionary<string, string>? Errors)>
        SaveMarketAsync(
            Guid valuationRequestId,
            Guid selectionId,
            SaveValuationComparableMarketRequest request,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل — لا يمكن تعديل التسويات" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = ValuationReportFreezeRules.FrozenMessageAr });
        }

        var row = await repo.FindSelectionAsync(valuationRequestId, selectionId, cancellationToken);
        if (row is null)
            return (null, new Dictionary<string, string> { ["_"] = "الاختيار غير موجود" });

 // Adjustments edit unlock (B-2 §13): absent row = unlocked, matching the defaults.
        var approachSettings = await repo.GetApproachSettingsAsync(
            valuationRequestId, cancellationToken);
        if (approachSettings is { AdjustmentsEditUnlocked: false })
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "صلاحية تحرير التسويات معطَّلة — تُفعَّل من إعدادات التقييم (شاشة 1)",
            });
        }

        // Interactive model spec: "blocking happens at adoption only — partial input is kept as draft".
        // Rationales are enforced by issuance gates and methodology alerts, not by save.
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

            // Q-8-2: empty override inherits the factor rationale, but a token (shorter than min) is rejected.
            if (JustificationRules.IsTooShort(line.Rationale))
                errors[$"adjustmentLines[{i}].rationale"] =
                    JustificationRules.TooShortMessageAr("مبرر التسوية للمقارن");
        }

        if (request.WeightIsManual)
        {
            if (request.WeightPct is null)
                errors["weightPct"] = "الوزن اليدوي مطلوب";
            else if (request.WeightPct is < 0m or > 100m)
                errors["weightPct"] = "الوزن يجب أن يكون بين 0 و 100";

            if (JustificationRules.IsTooShort(request.WeightOverrideRationale))
                errors["weightOverrideRationale"] =
                    JustificationRules.TooShortMessageAr("مبرر الوزن اليدوي");
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

        await repo.RemoveAdjustmentLinesAsync(row.AdjustmentLines.ToList(), cancellationToken);
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
                // Defined factors always keep their standard labels — a custom label is accepted
                // for custom factors only (guard against mangled encoding labels).
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

        await repo.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    private async Task<ValuationComparableSelectionDto?> GetSelectionDtoAsync(
        Guid selectionId,
        CancellationToken cancellationToken)
    {
        var row = await repo.GetSelectionAsync(selectionId, cancellationToken);
        if (row is null) return null;

        var request = await repo.GetRequestAsync(row.ValuationRequestId, cancellationToken);
        if (request is null) return null;

        var all = await repo.ListSelectionsAsync(
            row.ValuationRequestId, row.SelectionContext, cancellationToken);
        var comps = await repo.GetComparablesAsync(
            all.Select(a => a.ComparablePropertyId).ToList(), cancellationToken);

        var list = ValuationComparableListBuilder.BuildList(
            request,
            all,
            comps,
            DateOnly.FromDateTime(_time.UtcNow()),
            await repo.GetMarketApproachAsync(row.ValuationRequestId, cancellationToken),
            row.SelectionContext,
            factorRationales: []);
        return list.Items.FirstOrDefault(i => i.Id == selectionId);
    }

    public async Task<(ValuationComparableSelectionListDto? Result, Dictionary<string, string>? Errors)>
        SaveMarketApproachAsync(
            Guid valuationRequestId,
            SaveValuationMarketApproachRequest request,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = ValuationReportFreezeRules.FrozenMessageAr });
        }

        if (request.SubjectAreaSqm is < 0m)
            return (null, new Dictionary<string, string> { ["subjectAreaSqm"] = "المساحة يجب أن تكون ≥ 0" });
        if (request.AdjustmentBasis is not null && !MarketAdjustmentBasisKeys.IsKnown(request.AdjustmentBasis))
            return (null, new Dictionary<string, string> { ["adjustmentBasis"] = "أساس التسويات غير معروف" });

        var header = await repo.FindMarketApproachAsync(valuationRequestId, cancellationToken);
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
            await repo.AddMarketApproachAsync(header, cancellationToken);
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
            header.SubjectSpecJson = ValuationComparableListBuilder.SerializeSubjectSpecs(request.SubjectSpecs);
        header.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);
        return (await ListAsync(valuationRequestId, cancellationToken), null);
    }

    private async Task<bool> ImportPropertyLinkedComparablesAsync(
        ValuationRequest request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.PropertyId, out var propertyId) || propertyId == Guid.Empty)
            return false;

        var links = await repo.ListPropertyLinkedComparableIdsAsync(propertyId, cancellationToken);
        if (links.Count == 0) return false;

        var existing = (await repo.FindSelectionsAsync(
                request.Id, ComparableSelectionContexts.Market, cancellationToken))
            .Select(x => x.ComparablePropertyId)
            .ToHashSet();

        var missing = links.Where(id => !existing.Contains(id)).Distinct().ToList();
        if (missing.Count == 0) return true;

        var activeIds = (await repo.ListActiveComparableIdsAsync(missing, cancellationToken))
            .ToHashSet();

        var maxOrder = await repo.MaxSortOrderAsync(
            request.Id, ComparableSelectionContexts.Market, cancellationToken);

        var now = _time.UtcNow();
        var added = false;
        foreach (var comparableId in missing)
        {
            if (!activeIds.Contains(comparableId)) continue;
            var selectionId = Guid.NewGuid();
            await repo.AddSelectionAsync(
                new ValuationComparableSelection
                {
                    Id = selectionId,
                    ValuationRequestId = request.Id,
                    ComparablePropertyId = comparableId,
                    SelectionContext = ComparableSelectionContexts.Market,
                    SortOrder = ++maxOrder,
                    IsAdopted = true,
                    SelectedAtUtc = now,
                },
                cancellationToken);
            await repo.AddAdjustmentLinesAsync(
                MarketApproachRules.CreateStandardMarketLines(selectionId).ToList(),
                cancellationToken);
            added = true;
        }

        if (!added) return true;

        await EnsureMarketApproachHeaderAsync(request.Id, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task EnsureMarketApproachHeaderAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        var exists = await repo.MarketApproachExistsAsync(valuationRequestId, cancellationToken);
        if (exists) return;

        var org = await organizationSettings.GetInternalAsync(cancellationToken);
        await repo.AddMarketApproachAsync(
            new ValuationMarketApproach
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
            },
            cancellationToken);
    }
}
