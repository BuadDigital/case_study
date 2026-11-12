// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Deal age, time adjustment and freshness are measured to the official valuation date (the
//         retrospective date when chosen, else today) instead of today (OfficialValuationDateAsync).
//  • The land table reads the apartment's land share saved on the cost approach.
//  • Market Replacing the comparable list keeps the rows of comparables that stay — their adjustments,
//           manual weight and overrides survive; only dropped comparables are removed.
//  • Market A duplicate factor key on one comparable is refused with a 400 (DuplicateFactorKeyErrors).
//  • Auto-adopt: a land comparable linked to a built subject goes to the land table inside the cost
//         approach, never the market table (problem 22).
// Round 2 (1b19bedc)
//  • A    The land table reads the building plot and the apartment's share (CostLandAreasAsync).
//  • The hard alert 23 cutoff date is passed to the list builder, so later-dated comparables get
//         automatic weight 0 (ValuationDatesAsync).
//  • An unknown selectionContext is refused on every write.
// Grey areas (2026-11-10)
//  • A removed property-linked comparable stays removed (ValuationDismissedLinkedComparable rows; a
//         re-add from the bank clears them); a comparable linked later still imports.
//  • The read-time import and the demo clean-up ask the full write lock (hand-over / review included).
//  • The market value is rounded by ValueRoundDecimals, except on a request deposited / done before the
//         rounding (MarketValueUnrounded flag); a later deposit keeps the rounded value.
// One land table (2026-11-12)
//  • A subject valued as land has one table: land_within_cost reads and writes the market table's
//         rows (TableOfAsync, ValuationComparableSelectionService.OneLandTable.cs).
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
/// Persistence goes through <see cref="IValuationComparableSelectionRepository"/> and the
/// freeze through <see cref="IValuationReportFreezeGate"/>, so this file holds rules only -
/// no EF (solid-scorecard finding 1). Request checks and entity shaping live in
/// <see cref="ValuationComparableSelectionRequestRules"/>; the factor-rationale and
/// market-approach header concerns sit in their partial files.
/// </summary>
public sealed partial class ValuationComparableSelectionService(
    IValuationComparableSelectionRepository repo,
    IValuationReportFreezeGate freeze,
    IOrganizationSettingsService organizationSettings,
    TimeProvider? time = null,
    ICaseStudyLookup? caseStudy = null)
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
            // The full write lock (deposit + hand-over/review) is asked once, and only when this read
            // would write something — it reaches the case-study service.
            var mayWrite = new ReadWriteLock(freeze, request);
            await ImportPropertyLinkedComparablesAsync(request, mayWrite, cancellationToken);
        }

        // The land of a subject valued as land is the market table's rows (TableOfAsync).
        var table = await TableOfAsync(request, context, cancellationToken);
        var rows = await repo.ListSelectionsAsync(valuationRequestId, table, cancellationToken);

        var compIds = rows.Select(r => r.ComparablePropertyId).Distinct().ToList();
        var comps = await repo.GetComparablesAsync(compIds, cancellationToken);

        var (valuationDate, cutoff) = await ValuationDatesAsync(valuationRequestId, cancellationToken);
        var header = await repo.GetMarketApproachAsync(valuationRequestId, cancellationToken);
        var factorRationales = await repo.ListFactorRationalesAsync(
            valuationRequestId, table, cancellationToken);
        return ValuationComparableListBuilder.BuildList(
            request, rows, comps, valuationDate, header, context, factorRationales, cutoff,
            await CostLandAreasAsync(valuationRequestId, context, cancellationToken),
            roundOpinionValue: context == ComparableSelectionContexts.Market
                && !await HandedOverValueIsFixedAsync(request, header, cancellationToken),
            landSharedWithMarket: table != context);
    }

    /// <summary>
    /// What: true when the request's market value was handed over unrounded — deposited (or done) before
    /// the market rounding was switched on — so it keeps that figure.
    /// How it works: the market header's <see cref="ValuationMarketApproach.MarketValueUnrounded"/> flag,
    /// set by the migration for the requests deposited or done at that time. A request with no header yet
    /// falls back to the deposit layer (<see cref="IValuationReportFreezeGate.IsFrozenAsync"/>) and Done.
    /// Edge cases: fixed 2026-11-10 (same day) — the exemption used to follow the deposit itself, so a
    /// NEW request reconciled with the rounded value (3,203,000 in its deposited report) flipped to the
    /// unrounded one (3,200,000) the moment it was deposited, and the Enfaz assistant uploaded that.
    /// </summary>
    private async Task<bool> HandedOverValueIsFixedAsync(
        ValuationRequest request,
        ValuationMarketApproach? header,
        CancellationToken cancellationToken) =>
        header is not null
            ? header.MarketValueUnrounded
            : request.Status == ValuationRequestStatus.Done
              || await freeze.IsFrozenAsync(request.Id, cancellationToken);

    /// <summary>
    /// What: the full valuation write lock (deposit + hand-over/review), asked at most once per read.
    /// How it works: <see cref="ValuationReportFreezeGateExtensions.GetWriteBlockedMessageAsync"/> — the
    /// same check every edit uses — memoised, so the import and the demo clean-up share one answer.
    /// Edge cases (2026-11-10): the read-time writes used to ask only <c>IsFrozenAsync</c>, so a request
    /// handed over for review still got new adopted comparables and moved its value under the reviewer.
    /// </summary>
    private sealed class ReadWriteLock(IValuationReportFreezeGate freeze, ValuationRequest request)
    {
        private bool? _open;

        public async Task<bool> IsOpenAsync(CancellationToken cancellationToken) =>
            _open ??= await freeze.GetWriteBlockedMessageAsync(
                request, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات", cancellationToken) is null;
    }

    /// <summary>
    /// The land table inside the cost approach compares with the building plot saved on the
    /// cost approach and multiplies the apartment's share; the market table reads neither.
    /// </summary>
    private async Task<CostLandAreas?> CostLandAreasAsync(
        Guid valuationRequestId,
        string? selectionContext,
        CancellationToken cancellationToken) =>
        ComparableSelectionContexts.Normalize(selectionContext) == ComparableSelectionContexts.LandWithinCost
            ? await repo.GetCostLandAreasAsync(valuationRequestId, cancellationToken)
            : null;

    /// <summary>
    /// Deal age, the suggested time adjustment and freshness are measured to the official
    /// valuation date — the retrospective date when chosen, otherwise today. The cutoff is the last
    /// deal date hard alert 23 accepts (null when it is not evaluated).
    /// </summary>
    private async Task<(DateOnly ValuationDate, DateOnly? HardCutoff)> ValuationDatesAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        var settings = await repo.GetApproachSettingsAsync(valuationRequestId, cancellationToken);
        var today = RiyadhClock.Today(_time);
        return (
            MarketApproachRules.OfficialValuationDate(
                settings?.ValuationDateMode,
                settings?.RetrospectiveDate,
                today),
            MarketApproachRules.HardComparableDateCutoff(
                settings?.ValuationDateMode,
                settings?.RetrospectiveDate,
                settings?.RetrospectiveDateEnd,
                today));
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

        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

        if (ValuationComparableSelectionRequestRules.SelectionContextError(request.SelectionContext) is { } contextError)
            return (null, new Dictionary<string, string> { ["selectionContext"] = contextError });

        var items = request.Items ?? [];
        var (ids, errors) = ValuationComparableSelectionRequestRules.ValidateReplaceItems(items);
        if (errors.Count > 0) return (null, errors);

        var activeComps = await repo.ListActiveComparableIdsAsync(ids, cancellationToken);
        errors = ValuationComparableSelectionRequestRules.MissingActiveComparableErrors(
            ids, activeComps.ToHashSet());
        if (errors.Count > 0) return (null, errors);

        var context = await TableOfAsync(vr, request.SelectionContext, cancellationToken);
        var existing = await repo.FindSelectionsAsync(
            valuationRequestId, context, cancellationToken);
        // A comparable that stays in the list keeps its row — saved adjustments, manual weight
        // and price/area overrides survive; only comparables dropped from the list are removed.
        var keptIds = ids.ToHashSet();
        var existingByComparable = existing
            .GroupBy(x => x.ComparablePropertyId)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.SortOrder).First());
        await repo.RemoveSelectionsAsync(
            existing
                .Where(x => !keptIds.Contains(x.ComparablePropertyId)
                    || !ReferenceEquals(existingByComparable[x.ComparablePropertyId], x))
                .ToList(),
            cancellationToken);
        // A linked comparable dropped from the list stays dropped (the import skips it); one added back
        // from the bank is no longer dismissed.
        await DismissLinkedAsync(
            vr,
            existingByComparable.Keys.Where(id => !keptIds.Contains(id)).ToList(),
            cancellationToken);
        await repo.ClearDismissedLinkedComparablesAsync(
            valuationRequestId,
            keptIds.Where(id => !existingByComparable.ContainsKey(id)).ToList(),
            cancellationToken);

        var now = _time.UtcNow();
        var ordered = ValuationComparableSelectionRequestRules.OrderReplaceItems(items);

        for (var i = 0; i < ordered.Count; i++)
        {
            var it = ordered[i];
            if (existingByComparable.TryGetValue(it.ComparablePropertyId, out var kept))
            {
                kept.SortOrder = i;
                if (kept.IsAdopted != it.IsAdopted)
                {
                    kept.IsAdopted = it.IsAdopted;
                    kept.SelectedByUserId = selectedByUserId;
                    kept.SelectedAtUtc = now;
                }

                continue;
            }

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
        return (
            await ListAsync(
                valuationRequestId,
                ComparableSelectionContexts.Normalize(request.SelectionContext),
                cancellationToken),
            null);
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
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات", cancellationToken);
        if (blocked is not null)
            return (null, blocked);
        if (ValuationComparableSelectionRequestRules.SelectionContextError(selectionContext) is { } contextError)
            return (null, contextError);

        var context = await TableOfAsync(vr, selectionContext, cancellationToken);
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
            // Adopted back from the bank: a dismissed linked comparable is the appraiser's again.
            await repo.ClearDismissedLinkedComparablesAsync(
                valuationRequestId, [comparablePropertyId], cancellationToken);
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
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل — لا يمكن تعديل المقارنات", cancellationToken);
        if (blocked is not null)
            return (false, blocked);
        if (ValuationComparableSelectionRequestRules.SelectionContextError(selectionContext) is { } contextError)
            return (false, contextError);

        var context = await TableOfAsync(vr, selectionContext, cancellationToken);
        var row = await repo.FindSelectionByComparableAsync(
            valuationRequestId, comparablePropertyId, context, includeLines: false, cancellationToken);
        if (row is null) return (false, "المقارن غير مختار");

        await repo.RemoveSelectionAsync(row, cancellationToken);
        await DismissLinkedAsync(vr, [comparablePropertyId], cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    /// <summary>
    /// What: records that the appraiser removed these comparables from this valuation, for the ones
    /// linked to the subject property, so the linked-comparable import does not bring them back.
    /// How it works: keeps only ids in the property's links and stages one dismissal row each (saved
    /// with the caller's save). A comparable entered from the bank (not linked) needs no row — the
    /// import never adds it.
    /// Edge cases and what was fixed (2026-11-10): the import ran on every market read and re-added any
    /// linked comparable without a selection row, so «حذف» lasted until the next refresh (seen live).
    /// A comparable linked to the property later has no row and still arrives.
    /// </summary>
    private async Task DismissLinkedAsync(
        ValuationRequest vr,
        IReadOnlyCollection<Guid> removedComparableIds,
        CancellationToken cancellationToken)
    {
        if (removedComparableIds.Count == 0 || vr.PropertyId == Guid.Empty) return;
        var linked = (await repo.ListPropertyLinkedComparableIdsAsync(vr.PropertyId, cancellationToken))
            .ToHashSet();
        var dismissed = removedComparableIds.Where(linked.Contains).ToList();
        if (dismissed.Count == 0) return;
        await repo.DismissLinkedComparablesAsync(vr.Id, dismissed, _time.UtcNow(), cancellationToken);
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
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل — لا يمكن تعديل التسويات", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

        var row = await repo.FindSelectionAsync(valuationRequestId, selectionId, cancellationToken);
        if (row is null)
            return (null, new Dictionary<string, string> { ["_"] = "الاختيار غير موجود" });

 // Adjustments edit unlock (B-2 section 13): absent row = unlocked, matching the defaults.
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
        foreach (var (field, message) in DuplicateFactorKeyErrors(request))
            errors[field] = message;
        if (errors.Count > 0) return (null, errors);

        await repo.RemoveAdjustmentLinesAsync(row.AdjustmentLines.ToList(), cancellationToken);
        var newLines = ValuationComparableSelectionRequestRules.ApplyMarketSave(row, request);
        await repo.AddAdjustmentLinesAsync(newLines, cancellationToken);

        await repo.SaveChangesAsync(cancellationToken);
        return (await GetSelectionDtoAsync(row.Id, cancellationToken), null);
    }

    /// <summary>
    /// One line per factor on a comparable — a second «location» row would count the same
    /// difference twice (and the UI shows only one), so the save is refused with 400.
    /// </summary>
    public static Dictionary<string, string> DuplicateFactorKeyErrors(
        SaveValuationComparableMarketRequest request)
    {
        var errors = new Dictionary<string, string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var lines = request.AdjustmentLines ?? [];
        for (var i = 0; i < lines.Count; i++)
        {
            var key = lines[i].FactorKey?.Trim() ?? "";
            if (key.Length == 0) continue;
            if (!seen.Add(key))
                errors[$"adjustmentLines[{i}].factorKey"] = "عامل التسوية مكرر على المقارن نفسه — سطر واحد لكل عامل";
        }

        return errors;
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

        var (valuationDate, cutoff) = await ValuationDatesAsync(row.ValuationRequestId, cancellationToken);
        var list = ValuationComparableListBuilder.BuildList(
            request,
            all,
            comps,
            valuationDate,
            await repo.GetMarketApproachAsync(row.ValuationRequestId, cancellationToken),
            row.SelectionContext,
            factorRationales: [],
            hardComparableDateCutoff: cutoff,
            costLand: await CostLandAreasAsync(row.ValuationRequestId, row.SelectionContext, cancellationToken));
        return list.Items.FirstOrDefault(i => i.Id == selectionId);
    }

    /// <summary>
    /// Brings the comparables entered inside this property's transaction into its tables, adopted.
    /// How it works: runs on each market read. A comparable linked to the property and not yet in the
    /// market table is added; a land comparable of a built subject goes where it can be seen, by
    /// <see cref="LinkedComparableRules"/>.
    /// Edge cases: the type alone used to decide, so a villa valued as «أرض فقط» sent its land comparable
    /// to the land table, which that scope never shows: adopted, invisible, and absent from the value.
    /// Such a row now enters the market table on the next read. A valuation whose writes are blocked takes
    /// nothing here, because a new adopted row would move a value already handed over.
    /// Fixed 2026-11-10: (1) a comparable the appraiser removed came back on the next read — removals of
    /// linked comparables are now recorded per request (<see cref="DismissLinkedAsync"/>) and skipped here,
    /// while a comparable linked later still arrives; (2) only the deposit freeze was asked, so a request
    /// handed over for review still received new adopted rows — the full write lock is asked now.
    /// </summary>
    private async Task<bool> ImportPropertyLinkedComparablesAsync(
        ValuationRequest request,
        ReadWriteLock mayWrite,
        CancellationToken cancellationToken)
    {
        var propertyId = request.PropertyId;
        if (propertyId == Guid.Empty)
            return false;

        var links = await repo.ListPropertyLinkedComparableIdsAsync(propertyId, cancellationToken);
        if (links.Count == 0) return false;
        var dismissed = await repo.ListDismissedLinkedComparableIdsAsync(request.Id, cancellationToken);
        links = links.Where(id => !dismissed.Contains(id)).ToList();
        if (links.Count == 0) return true;

        var existing = (await repo.FindSelectionsAsync(
                request.Id, ComparableSelectionContexts.Market, cancellationToken))
            .Select(x => x.ComparablePropertyId)
            .ToHashSet();

        // Problem 22: a land comparable linked to a BUILT subject never lands in the market
        // table — it is a land-value input, so it goes to the land table (within the cost approach).
        var builtSubject = !ValuationApproachSettingsRules.IsLandPropertyType(request.PropertyType);
        var existingLand = builtSubject
            ? (await repo.FindSelectionsAsync(
                    request.Id, ComparableSelectionContexts.LandWithinCost, cancellationToken))
                .Select(x => x.ComparablePropertyId)
                .ToHashSet()
            : [];

        var candidates = DemoComparableBank
            .Exclude(links.Where(id => !existing.Contains(id)))
            .ToList();
        if (candidates.Count == 0) return true;

        var settings = await repo.GetApproachSettingsAsync(request.Id, cancellationToken);
        var landTableShown = LinkedComparableRules.LandTableIsShown(
            settings?.CostApproachEnabled,
            settings?.CostScopeKey);

        var activeIds = (await repo.ListActiveComparableIdsAsync(candidates, cancellationToken))
            .ToHashSet();
        var linkedComps = builtSubject
            ? await repo.GetComparablesAsync(candidates, cancellationToken)
            : new Dictionary<Guid, ComparableProperty>();

        var maxOrder = await repo.MaxSortOrderAsync(
            request.Id, ComparableSelectionContexts.Market, cancellationToken);
        var maxLandOrder = builtSubject
            ? await repo.MaxSortOrderAsync(
                request.Id, ComparableSelectionContexts.LandWithinCost, cancellationToken)
            : 0;

        var now = _time.UtcNow();
        var added = false;
        var landAdoptedInMarket = false;
        foreach (var comparableId in candidates)
        {
            if (!activeIds.Contains(comparableId)) continue;
            var isLandComp = builtSubject
                && linkedComps.TryGetValue(comparableId, out var linked)
                && PropertyCategoryRules.Categorize(linked.ComparablePropertyType, linked.Usage)
                    == PropertyCategoryRules.Land;
            var toLandTable = isLandComp && landTableShown;
            if (toLandTable && existingLand.Contains(comparableId)) continue;
            var adoptInMarket = !toLandTable
                && (!isLandComp || LinkedComparableRules.AdoptLandInMarket(settings?.CostScopeKey));
            // Asked only when a row is really about to be added (a land comparable already in the land
            // table adds nothing), and once per read: blocked → nothing is imported.
            if (!await mayWrite.IsOpenAsync(cancellationToken)) return true;
            landAdoptedInMarket |= isLandComp && adoptInMarket;
            var selectionId = Guid.NewGuid();
            await repo.AddSelectionAsync(
                new ValuationComparableSelection
                {
                    Id = selectionId,
                    ValuationRequestId = request.Id,
                    ComparablePropertyId = comparableId,
                    SelectionContext = toLandTable
                        ? ComparableSelectionContexts.LandWithinCost
                        : ComparableSelectionContexts.Market,
                    SortOrder = toLandTable ? ++maxLandOrder : ++maxOrder,
                    IsAdopted = toLandTable || adoptInMarket,
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
        // A header saved while the villa was still compared as a whole keeps that basis once the scope
        // becomes «أرض فقط», and a whole plot's price would then stand for the subject's land unmultiplied.
        if (landAdoptedInMarket
            && await repo.FindMarketApproachAsync(request.Id, cancellationToken) is { } header
            && MarketAdjustmentBasisKeys.Normalize(header.AdjustmentBasis) == MarketAdjustmentBasisKeys.WholeProperty)
        {
            header.AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm;
            header.UpdatedAtUtc = now;
        }

        // The reconciliation read and the selections read both open a fresh request at once, so both import
        // the same linked comparables. TrySaveSeedAsync tolerates losing that race (the winner's rows are
        // read afterwards) instead of failing the whole request with a 500.
        await repo.TrySaveSeedAsync(cancellationToken);
        return true;
    }
}
