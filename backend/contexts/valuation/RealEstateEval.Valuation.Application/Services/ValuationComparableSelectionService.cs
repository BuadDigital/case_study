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
/// no EF (solid-scorecard finding 1). Request checks and entity shaping live in
/// <see cref="ValuationComparableSelectionRequestRules"/>; the factor-rationale (Q-8) and
/// market-approach header concerns sit in their partial files.
/// </summary>
public sealed partial class ValuationComparableSelectionService(
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
        var (ids, errors) = ValuationComparableSelectionRequestRules.ValidateReplaceItems(items);
        if (errors.Count > 0) return (null, errors);

        var activeComps = await repo.ListActiveComparableIdsAsync(ids, cancellationToken);
        errors = ValuationComparableSelectionRequestRules.MissingActiveComparableErrors(
            ids, activeComps.ToHashSet());
        if (errors.Count > 0) return (null, errors);

        var context = ComparableSelectionContexts.Normalize(request.SelectionContext);
        var existing = await repo.FindSelectionsAsync(
            valuationRequestId, context, cancellationToken);
        await repo.RemoveSelectionsAsync(existing, cancellationToken);

        var now = _time.UtcNow();
        var ordered = ValuationComparableSelectionRequestRules.OrderReplaceItems(items);

        for (var i = 0; i < ordered.Count; i++)
        {
            var it = ordered[i];
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

        var errors = ValuationComparableSelectionRequestRules.ValidateMarketSave(request);
        if (errors.Count > 0) return (null, errors);

        await repo.RemoveAdjustmentLinesAsync(row.AdjustmentLines.ToList(), cancellationToken);
        var newLines = ValuationComparableSelectionRequestRules.ApplyMarketSave(row, request);
        await repo.AddAdjustmentLinesAsync(newLines, cancellationToken);

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

    private async Task<bool> ImportPropertyLinkedComparablesAsync(
        ValuationRequest request,
        CancellationToken cancellationToken)
    {
        var propertyId = request.PropertyId;
        if (propertyId == Guid.Empty)
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
}
