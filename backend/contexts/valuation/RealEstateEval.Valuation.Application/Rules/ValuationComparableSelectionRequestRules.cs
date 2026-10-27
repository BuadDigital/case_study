// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • R2-10 An unknown selectionContext is refused (SelectionContextError) — it was read silently as market.
//  • B    A written factor rationale for a non-zero factor and the manual weight rationale must be at
//         least 10 characters (IsBelowRequiredMinimum / RequiredMinimumMessageAr); blank still saves as draft.
//  • R2-5 Bounds with Arabic 400s: comparable price override ≤ 1e12 SAR, area override ≤ 10,000,000 m².
//  • R2-5 Market header: subject area > 0 on the per-m² basis and ≤ 10,000,000 m²; area factor 0.1–50,
//         annual market rate 0–50, rounding 0–6 — refused instead of dropped silently; all errors returned.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Pure request validation and entity shaping for the comparable-selection service (replace list,
/// per-comparable market save, market-approach header). No ports, no I/O, no EF — the service
/// keeps the load / freeze / save sequence and calls these in between.
/// </summary>
public static class ValuationComparableSelectionRequestRules
{
    /// <summary>
    /// Replace-list item checks: every id present and no duplicates. <c>Ids</c> is the distinct
    /// id set in first-seen order, used for the active-comparable lookup that follows.
    /// </summary>
    public static (IReadOnlyList<Guid> Ids, Dictionary<string, string> Errors) ValidateReplaceItems(
        IReadOnlyList<ValuationComparableSelectionItemRequest> items)
    {
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

        return (seen.ToList(), errors);
    }

    public const string UnknownSelectionContextAr =
        "سياق المقارنات غير معروف (أسلوب السوق / تقدير الأرض ضمن التكلفة)";

    /// <summary>
    /// Round 2: an unknown <c>selectionContext</c> («xyz») is refused on every write — it used to be
    /// read silently as the market table. Blank keeps the market default.
    /// </summary>
    public static string? SelectionContextError(string? selectionContext) =>
        string.IsNullOrWhiteSpace(selectionContext) || ComparableSelectionContexts.IsKnown(selectionContext)
            ? null
            : UnknownSelectionContextAr;

    /// <summary>One error per requested id that is not an active bank comparable.</summary>
    public static Dictionary<string, string> MissingActiveComparableErrors(
        IEnumerable<Guid> ids,
        IReadOnlySet<Guid> activeIds)
    {
        var errors = new Dictionary<string, string>();
        foreach (var id in ids)
        {
            if (!activeIds.Contains(id))
                errors[id.ToString()] = "المقارن غير موجود أو معطّل";
        }

        return errors;
    }

    /// <summary>Requested sort order first, then request position as the tie-breaker.</summary>
    public static IReadOnlyList<ValuationComparableSelectionItemRequest> OrderReplaceItems(
        IReadOnlyList<ValuationComparableSelectionItemRequest> items) =>
        items
            .Select((it, idx) => new { it, idx })
            .OrderBy(x => x.it.SortOrder)
            .ThenBy(x => x.idx)
            .Select(x => x.it)
            .ToList();

    /// <summary>
    /// Per-comparable market save checks. Interactive model spec: "blocking happens at adoption
    /// only — partial input is kept as draft", so a BLANK rationale saves; the issuance gate
    /// <c>adjustment_rationales_*</c> (<see cref="ValuationIssuanceGateRules.AdjustmentRationales"/>)
    /// then blocks issuance and hand-over until each is written. Q-8-2 still rejects token (written
    /// but shorter than 10 characters) rationales here.
    /// </summary>
    public static Dictionary<string, string> ValidateMarketSave(SaveValuationComparableMarketRequest request)
    {
        var lines = request.AdjustmentLines ?? [];
        var errors = new Dictionary<string, string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var key = line.FactorKey?.Trim() ?? "";
            if (!MarketAdjustmentFactorKeys.IsKnown(key))
                errors[$"adjustmentLines[{i}].factorKey"] = "عامل تسوية غير معروف";

            if ((key == MarketAdjustmentFactorKeys.Custom
                 || MarketAdjustmentFactorKeys.IsExtraCatalogKey(key))
                && string.IsNullOrWhiteSpace(line.LabelAr))
                errors[$"adjustmentLines[{i}].labelAr"] = "تسمية العامل المضاف مطلوبة";

            if (line.Percent is < -100m or > 100m)
                errors[$"adjustmentLines[{i}].percent"] = "النسبة يجب أن تكون بين -100 و 100";

            // Q-8-2 / decision B: empty override inherits the factor rationale; a written one for a
            // non-zero factor is at least 10 characters.
            if (line.Percent != 0m && JustificationRules.IsBelowRequiredMinimum(line.Rationale))
                errors[$"adjustmentLines[{i}].rationale"] =
                    JustificationRules.RequiredMinimumMessageAr("مبرر التسوية للمقارن");
        }

        if (request.WeightIsManual)
        {
            if (request.WeightPct is null)
                errors["weightPct"] = "الوزن اليدوي مطلوب";
            else if (request.WeightPct is < 0m or > 100m)
                errors["weightPct"] = "الوزن يجب أن يكون بين 0 و 100";

            if (JustificationRules.IsBelowRequiredMinimum(request.WeightOverrideRationale))
                errors["weightOverrideRationale"] =
                    JustificationRules.RequiredMinimumMessageAr("مبرر الوزن اليدوي");
        }

        if (request.PriceOverrideSar is < 0m)
            errors["priceOverrideSar"] = "سعر العقار يجب أن يكون ≥ 0";
        else if (request.PriceOverrideSar > ComparablePropertyRules.MaxPriceSar)
            errors["priceOverrideSar"] = "سعر العقار يتجاوز الحد المعقول (1,000,000,000,000 ر.س)";
        if (request.AreaOverrideSqm is <= 0m)
            errors["areaOverrideSqm"] = "مساحة المقارن يجب أن تكون أكبر من صفر";
        else if (request.AreaOverrideSqm > MarketApproachRules.MaxSubjectAreaSqm)
            errors["areaOverrideSqm"] = "مساحة المقارن تتجاوز الحد المعقول (10,000,000 م²)";

        if (request.AreaAdjustmentMethod is not null
            && !AreaAdjustmentMethods.IsKnown(request.AreaAdjustmentMethod))
        {
            errors["areaAdjustmentMethod"] = "طريقة قياس تسوية المساحة غير معروفة";
        }

        return errors;
    }

    /// <summary>
    /// Adjustment line from a save request. Defined factors always keep their standard labels —
    /// a custom label is accepted for custom factors only (guard against mangled encoding labels).
    /// IDs are always new: the caller deletes the previous rows first, so reusing a client id
    /// would collide with the tracked-deleted entities.
    /// </summary>
    public static ValuationComparableAdjustmentLine BuildAdjustmentLine(
        Guid selectionId,
        SaveValuationComparableAdjustmentLineRequest line,
        int index)
    {
        var key = line.FactorKey.Trim();
        return new ValuationComparableAdjustmentLine
        {
            Id = Guid.NewGuid(),
            SelectionId = selectionId,
            FactorKey = key,
            LabelAr = MarketAdjustmentFactorKeys.HasFixedStandardLabel(key)
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
            SortOrder = line.SortOrder != 0 ? line.SortOrder : index,
        };
    }

    /// <summary>
    /// Builds the selection's new adjustment lines from the (already validated) request and applies
    /// the weight / price / area overrides. The caller stages the removal of the old lines first and
    /// must add the returned lines via the DbSet (not this navigation collection) — EF marks an
    /// entity added through a tracked navigation collection as Modified when its key is already set,
    /// which turns the INSERT into a 0-row UPDATE and throws DbUpdateConcurrencyException.
    /// </summary>
    public static IReadOnlyList<ValuationComparableAdjustmentLine> ApplyMarketSave(
        ValuationComparableSelection row,
        SaveValuationComparableMarketRequest request)
    {
        var lines = request.AdjustmentLines ?? [];
        var built = new List<ValuationComparableAdjustmentLine>(lines.Count);
        for (var i = 0; i < lines.Count; i++)
            built.Add(BuildAdjustmentLine(row.Id, lines[i], i));

        row.WeightIsManual = request.WeightIsManual;
        row.WeightPct = request.WeightIsManual ? request.WeightPct : null;
        row.WeightOverrideRationale = request.WeightIsManual
            ? request.WeightOverrideRationale?.Trim()
            : null;
        row.PriceOverrideSar = request.PriceOverrideSar;
        row.AreaOverrideSqm = request.AreaOverrideSqm;
        if (request.AreaAdjustmentMethod is not null)
            row.AreaAdjustmentMethod = AreaAdjustmentMethods.Normalize(request.AreaAdjustmentMethod);

        return built;
    }

    /// <summary>
    /// Market-approach header checks — null when the request is acceptable. A coefficient outside its
    /// range is refused with an Arabic message (it used to be dropped silently).
    /// </summary>
    public static Dictionary<string, string>? ValidateMarketApproach(SaveValuationMarketApproachRequest request)
    {
        var errors = new Dictionary<string, string>();
        if (request.SubjectAreaSqm is < 0m)
            errors["subjectAreaSqm"] = "المساحة يجب أن تكون ≥ 0";
        // Round 2: the per-m² basis multiplies the weighted rate by this area — 0 is no area.
        else if (request.SubjectAreaSqm == 0m
                 && MarketAdjustmentBasisKeys.Normalize(request.AdjustmentBasis) != MarketAdjustmentBasisKeys.WholeProperty)
            errors["subjectAreaSqm"] = "مساحة العقار محل التقييم يجب أن تكون أكبر من صفر (أساس سعر المتر)";
        else if (request.SubjectAreaSqm > MarketApproachRules.MaxSubjectAreaSqm)
            errors["subjectAreaSqm"] = "المساحة تتجاوز الحد المعقول (10,000,000 م²)";
        if (request.AdjustmentBasis is not null && !MarketAdjustmentBasisKeys.IsKnown(request.AdjustmentBasis))
            errors["adjustmentBasis"] = "أساس التسويات غير معروف";
        if (request.AreaFactorPct is < MarketApproachRules.MinAreaFactorPct or > MarketApproachRules.MaxAreaFactorPct)
            errors["areaFactorPct"] = "معامل المساحة يجب أن يكون بين 0.1 و 50";
        if (request.AnnualMarketRatePct is < 0m or > MarketApproachRules.MaxAnnualMarketRatePct)
            errors["annualMarketRatePct"] = "معدل تغير السوق السنوي يجب أن يكون بين 0 و 50";
        if (request.ValueRoundDecimals is < 0 or > MarketApproachRules.MaxValueRoundDecimals)
            errors["valueRoundDecimals"] = "أسّ التقريب يجب أن يكون بين 0 و 6";
        return errors.Count == 0 ? null : errors;
    }

    /// <summary>
    /// New market-approach header seeded from organization defaults, falling back to the
    /// methodology constants when the org value is out of range. Coefficients are frozen on the
    /// header so later org changes never rewrite past valuations.
    /// </summary>
    public static ValuationMarketApproach SeedMarketApproach(
        Guid valuationRequestId,
        OrganizationValuationSettingsDto org) =>
        new()
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = valuationRequestId,
            AreaFactorPct = org.AreaFactorPct > 0
                ? org.AreaFactorPct
                : AreaAdjustmentRules.DefaultAreaFactorPct,
            AnnualMarketRatePct = org.AnnualMarketRatePct >= 0
                ? org.AnnualMarketRatePct
                : MarketApproachRules.DefaultAnnualMarketRatePct,
            ValueRoundDecimals = org.MarketValueRoundDecimals is >= 0 and <= 6
                ? org.MarketValueRoundDecimals
                : MarketApproachRules.DefaultValueRoundDecimals,
        };

    /// <summary>
    /// Applies a validated header save: subject area and basis always, coefficient overrides only
    /// when inside their allowed ranges, notes trimmed (blank clears), subject specs only when sent.
    /// </summary>
    public static void ApplyMarketApproach(
        ValuationMarketApproach header,
        SaveValuationMarketApproachRequest request)
    {
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
    }
}
