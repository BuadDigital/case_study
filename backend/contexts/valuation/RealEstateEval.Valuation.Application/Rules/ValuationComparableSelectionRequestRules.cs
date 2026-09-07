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
    /// only — partial input is kept as draft", so rationales are enforced by issuance gates and
    /// methodology alerts, not by save; Q-8-2 still rejects token (shorter than min) rationales.
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

    /// <summary>Market-approach header checks — null when the request is acceptable.</summary>
    public static Dictionary<string, string>? ValidateMarketApproach(SaveValuationMarketApproachRequest request)
    {
        if (request.SubjectAreaSqm is < 0m)
            return new Dictionary<string, string> { ["subjectAreaSqm"] = "المساحة يجب أن تكون ≥ 0" };
        if (request.AdjustmentBasis is not null && !MarketAdjustmentBasisKeys.IsKnown(request.AdjustmentBasis))
            return new Dictionary<string, string> { ["adjustmentBasis"] = "أساس التسويات غير معروف" };
        return null;
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
