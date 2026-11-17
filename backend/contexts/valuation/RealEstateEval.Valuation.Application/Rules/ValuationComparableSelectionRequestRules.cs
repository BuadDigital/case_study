// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • An unknown selectionContext is refused (SelectionContextError) — it was read silently as market.
//  • B    A written factor rationale for a non-zero factor and the manual weight rationale must be at
//         least 10 characters (IsBelowRequiredMinimum / RequiredMinimumMessageAr); blank still saves as draft.
//  • Bounds with Arabic 400s: comparable price override ≤ 1e12 SAR, area override ≤ 10,000,000 m².
//  • Market header: subject area > 0 on the per-m² basis and ≤ 10,000,000 m²; area factor 0.1–50,
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
    /// only — partial input is kept as draft".
    ///
    /// Edge cases: 2026-11-02 — the adjustment-factor and manual-weight rationales are optional notes
    /// of any length (the percentages are estimates); they are neither checked here nor at issuance.
    /// </summary>
    /// <param name="twoAreaLines">
    /// The table carries the two area lines of a built subject (2026-11-15): the appraiser may leave
    /// one of them out and keep the other, never both («اختيار واحد منهم على الأقل»).
    /// </param>
    public static Dictionary<string, string> ValidateMarketSave(
        SaveValuationComparableMarketRequest request,
        bool twoAreaLines = false)
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

            // 2026-11-02: a factor's rationale is an optional note of any length; an empty override
            // inherits the factor rationale.
        }

        // The difference factors add up before they apply: at −100٪ or below the comparable's price
        // turns zero or negative (two −90٪ factors gave a negative price). The area lines are computed by
        // the server and are not part of this sum.
        var differenceSum = lines
            .Where(l => l.IsIncluded
                && MarketAdjustmentFactorKeys.IsDifferenceFactor(l.FactorKey?.Trim() ?? "")
                && !MarketAdjustmentFactorKeys.IsComputedArea(l.FactorKey?.Trim()))
            .Sum(l => l.Percent);
        if (differenceSum <= -100m)
            errors["adjustmentLines"] = "مجموع تسويات الفروقات للمقارن يجب أن يكون أكبر من -100٪ — وإلا صار سعره صفراً أو سالباً";

        if (request.WeightIsManual)
        {
            if (request.WeightPct is null)
                errors["weightPct"] = "الوزن اليدوي مطلوب";
            else if (request.WeightPct is < 0m or > 100m)
                errors["weightPct"] = "الوزن يجب أن يكون بين 0 و 100";

        }

        if (request.PriceOverrideSar is < 0m)
            errors["priceOverrideSar"] = "سعر العقار يجب أن يكون ≥ 0";
        else if (request.PriceOverrideSar > ComparablePropertyRules.MaxPriceSar)
            errors["priceOverrideSar"] = "سعر العقار يتجاوز الحد المعقول (1,000,000,000,000 ر.س)";
        if (request.AreaOverrideSqm is <= 0m)
            errors["areaOverrideSqm"] = "مساحة المقارن يجب أن تكون أكبر من صفر";
        else if (request.AreaOverrideSqm > MarketApproachRules.MaxSubjectAreaSqm)
            errors["areaOverrideSqm"] = "مساحة المقارن تتجاوز الحد المعقول (10,000,000 م²)";

        if (request.LandAreaOverrideSqm is <= 0m)
            errors["landAreaOverrideSqm"] = "مساحة أرض المقارن يجب أن تكون أكبر من صفر";
        else if (request.LandAreaOverrideSqm > MarketApproachRules.MaxSubjectAreaSqm)
            errors["landAreaOverrideSqm"] = "مساحة أرض المقارن تتجاوز الحد المعقول (10,000,000 م²)";

        if (twoAreaLines && BothAreaLinesLeftOut(lines))
            errors["areaAdjustments"] = BothAreaLinesLeftOutAr;

        if (request.AreaAdjustmentMethod is not null
            && !AreaAdjustmentMethods.IsKnown(request.AreaAdjustmentMethod))
        {
            errors["areaAdjustmentMethod"] = "طريقة قياس تسوية المساحة غير معروفة";
        }

        return errors;
    }

    public const string BothAreaLinesLeftOutAr =
        "تسوية المساحة: أبقِ بند مساحة الأرض أو بند مساحة المباني — أحدهما على الأقل";

    /// <summary>
    /// Both area lines of a built subject are switched off on this comparable.
    /// How it works: the building's line counts as off when it is absent or excluded; the land's
    /// line only when it is sent and excluded — a comparable saved before the land line existed
    /// has none, and the server adds it switched on.
    /// </summary>
    public static bool BothAreaLinesLeftOut(
        IReadOnlyList<SaveValuationComparableAdjustmentLineRequest> lines)
    {
        var area = lines.FirstOrDefault(l => l.FactorKey?.Trim() == MarketAdjustmentFactorKeys.Area);
        var land = lines.FirstOrDefault(l => l.FactorKey?.Trim() == MarketAdjustmentFactorKeys.LandArea);
        return area is not { IsIncluded: true } && land is { IsIncluded: false };
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
        row.LandAreaOverrideSqm = request.LandAreaOverrideSqm;
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
        if (request.SubjectLandAreaSqm is < 0m)
            errors["subjectLandAreaSqm"] = "مساحة الأرض يجب أن تكون ≥ 0";
        else if (request.SubjectLandAreaSqm > MarketApproachRules.MaxSubjectAreaSqm)
            errors["subjectLandAreaSqm"] = "مساحة الأرض تتجاوز الحد المعقول (10,000,000 م²)";
        if (request.LandAreaFactorPct is < MarketApproachRules.MinAreaFactorPct or > MarketApproachRules.MaxAreaFactorPct)
            errors["landAreaFactorPct"] = "معامل مساحة الأرض يجب أن يكون بين 0.1 و 50";
        if (request.AnnualMarketRatePct is < 0m or > MarketApproachRules.MaxAnnualMarketRatePct)
            errors["annualMarketRatePct"] = "معدل تغير السوق السنوي يجب أن يكون بين 0 و 50";
        if (request.ValueRoundDecimals is < 0 or > MarketApproachRules.MaxValueRoundDecimals)
            errors["valueRoundDecimals"] = "أسّ التقريب يجب أن يكون بين 0 و 6";
        if (!IsAreaMethodChoice(request.AreaAdjustmentMethod))
            errors["areaAdjustmentMethod"] = UnknownAreaMethodAr;
        if (!IsAreaMethodChoice(request.LandAreaAdjustmentMethod))
            errors["landAreaAdjustmentMethod"] = UnknownAreaMethodAr;
        if (request.AreaCashRateSar is < 0m or > AreaAdjustmentRules.MaxCashRateSar)
            errors["areaCashRateSar"] = "سعر متر المباني يجب أن يكون بين 0 و 10,000,000 ر.س";
        if (request.LandAreaCashRateSar is < 0m or > AreaAdjustmentRules.MaxCashRateSar)
            errors["landAreaCashRateSar"] = "سعر متر الأرض يجب أن يكون بين 0 و 10,000,000 ر.س";
        return errors.Count == 0 ? null : errors;
    }

    private const string UnknownAreaMethodAr = "طريقة قياس تسوية المساحة غير معروفة";

    /// <summary>Not sent, «auto», or one of the known methods.</summary>
    private static bool IsAreaMethodChoice(string? value) =>
        value is null
        || value.Trim().Equals(AreaAdjustmentMethods.Auto, StringComparison.OrdinalIgnoreCase)
        || AreaAdjustmentMethods.IsKnown(value);

    /// <summary>
    /// What: the stored method of one area line after a save.
    /// How it works: null (not sent) keeps the stored one; «auto» clears it, so the table chooses again;
    /// a known method is stored normalised.
    /// </summary>
    private static string? NextAreaMethod(string? stored, string? sent) =>
        sent is null
            ? stored
            : sent.Trim().Equals(AreaAdjustmentMethods.Auto, StringComparison.OrdinalIgnoreCase)
                ? null
                : AreaAdjustmentMethods.Normalize(sent);

    /// <summary>A cash rate after a save: null keeps the stored one, 0 clears it.</summary>
    private static decimal? NextCashRate(decimal? stored, decimal? sent) =>
        sent is null ? stored : sent > 0m ? sent : null;

    /// <summary>
    /// New market-approach header seeded from organization defaults, falling back to the
    /// methodology constants when the org value is out of range. Coefficients are frozen on the
    /// header so later org changes never rewrite past valuations. The basis opens on
    /// <see cref="MarketAdjustmentBasisKeys.DefaultFor"/> — whole property for a building.
    /// </summary>
    public static ValuationMarketApproach SeedMarketApproach(
        Guid valuationRequestId,
        OrganizationValuationSettingsDto org,
        string? propertyType = null,
        string? costScopeKey = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = valuationRequestId,
            AdjustmentBasis = MarketAdjustmentBasisKeys.DefaultFor(propertyType, costScopeKey),
            AreaFactorPct = org.AreaFactorPct > 0
                ? org.AreaFactorPct
                : AreaAdjustmentRules.DefaultAreaFactorPct,
            // A header created from 2026-11-15 on gives a built subject its two area lines; the land
            // line opens on the same factor and is then the appraiser's to change on its own.
            TwoAreaAdjustments = true,
            LandAreaFactorPct = org.AreaFactorPct > 0
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
        // Not sent keeps the stored land area (older callers save the header without it); 0 clears it.
        if (request.SubjectLandAreaSqm is { } landArea)
            header.SubjectLandAreaSqm = landArea > 0m ? landArea : null;
        if (request.LandAreaFactorPct is >= 0.1m and <= 50m)
            header.LandAreaFactorPct = request.LandAreaFactorPct.Value;
        header.AreaAdjustmentMethod = NextAreaMethod(header.AreaAdjustmentMethod, request.AreaAdjustmentMethod);
        header.LandAreaAdjustmentMethod = NextAreaMethod(header.LandAreaAdjustmentMethod, request.LandAreaAdjustmentMethod);
        header.AreaCashRateSar = NextCashRate(header.AreaCashRateSar, request.AreaCashRateSar);
        header.LandAreaCashRateSar = NextCashRate(header.LandAreaCashRateSar, request.LandAreaCashRateSar);
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
