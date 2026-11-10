// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Bounds New file — pure validation of the cost-approach save, run before anything loads, so an absurd
//           or malformed payload is a 400 with an Arabic message, never a 500.
//  • Bounds Line count, quantity, unit cost, unit, build ratio, land share, indirect items (unknown /
//           duplicate / %), financing, ages and obsolescence % checked; duplicate line ids refused.
//  • Cost A repeated-floors line needs a floor count (RepeatedFloorRules.MissingInputMessage).
// Round 2 (1b19bedc)
//  • Line amount (quantity × unit cost), the direct total and the total with indirect costs ≤
//         MaxAmountSar (ValidateAmounts) — an overflow is a 400, not a 500.
//  • A    BuildingPlotAreaSqm must be > 0 and within the maximum; the apartment's land share cannot exceed it.
//  • B    Use-restriction, life-extension basis and functional / external obsolescence rationales are at
//         least 10 characters once written.
//  • An unknown line structureKind is refused instead of being stored as-is.
// Grey areas (2026-11-10)
//  • Repeated floors inherit area and unit cost from the INCLUDED first floor only (IncludedFirstFloor).
//  • IsStaleSave / ConflictKey / StaleSaveMessageAr — two tabs no longer overwrite each other (409).
// ──────────────────────────────────────────────────────────────────────────────────────────────

using System.Globalization;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Pure request validation for the cost-approach save — bounds, duplicate line ids and the
/// repeated-floors inputs. No ports, no I/O: the service runs these before it loads anything,
/// so an absurd or malformed payload is a 400 with an Arabic message, never a 500.
/// </summary>
public static class ValuationCostApproachRequestRules
{
    /// <summary>Field errors keyed like the screen's error targets (<c>lines[i].field</c>, <c>field</c>).</summary>
    public static Dictionary<string, string> Validate(SaveValuationCostApproachRequest request)
    {
        var errors = new Dictionary<string, string>();
        ValidateLines(request.Lines ?? [], errors);
        ValidateLand(request, errors);
        ValidateIndirect(request, errors);
        ValidateAgeAndObsolescence(request, errors);
        if (errors.Count == 0) ValidateAmounts(request, errors);
        return errors;
    }

    /// <summary>
    /// Quantity × unit cost per line, the direct total and the total with indirect costs stay within
    /// <see cref="CostApproachRules.MaxAmountSar"/> — computed as the read computes them (repeated floors
    /// from the first floor, inherited unit cost, build ratio), so an overflow is a 400, never a 500.
    /// </summary>
    private static void ValidateAmounts(
        SaveValuationCostApproachRequest request,
        Dictionary<string, string> errors)
    {
        var lines = request.Lines ?? [];
        var (firstFloorArea, firstFloorUnitCost) = IncludedFirstFloor(lines);
        var direct = 0m;
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var itemKey = CostLineItemKeys.Normalize(line.ItemKey);
            var quantity = itemKey == CostLineItemKeys.RepeatedFloors
                ? RepeatedFloorRules.QuantityForLine(firstFloorArea, line.RepeatedFloorCount)
                : line.AreaSqm;
            var total = CostApproachRules.LineTotal(
                CostApproachRules.EffectiveQuantity(quantity, line.Unit, line.BuildRatioPct, itemKey, line.StructureKind, line.Label),
                CostApproachRules.InheritedUnitCost(itemKey, line.UnitCostSar, firstFloorUnitCost));
            if (total > CostApproachRules.MaxAmountSar)
                errors[$"lines[{i}].unitCostSar"] =
                    $"مبلغ البند (الكمية × تكلفة الوحدة) يتجاوز الحد المعقول ({N(CostApproachRules.MaxAmountSar)} ر.س)";
            if (line.IsIncluded) direct += total;
        }

        if (errors.Count > 0) return;
        var indirectSum = CostApproachRules.IndirectSumPct(
            (request.IndirectItems ?? []).Select(x => x.Pct),
            CostApproachRules.FinancingPct(request.FinancingAnnualRatePct, request.FinancingMonths));
        if (direct > CostApproachRules.MaxAmountSar
            || CostApproachRules.TotalCostWithIndirect(direct, indirectSum) > CostApproachRules.MaxAmountSar)
        {
            errors["lines"] =
                $"إجمالي التكلفة (المباشرة مع غير المباشرة) يتجاوز الحد المعقول ({N(CostApproachRules.MaxAmountSar)} ر.س)";
        }
    }

    /// <summary>
    /// The first-floor area the repeated-floors quantity derives from — the INCLUDED «الدور الأول»
    /// only (<see cref="RepeatedFloorRules.IncludedFirstFloor"/>); 0 when it is excluded or missing.
    /// Fixed 2026-11-10: an excluded first floor still gave its area.
    /// </summary>
    public static decimal FirstFloorArea(IReadOnlyList<SaveValuationCostLineRequest> lines) =>
        IncludedFirstFloor(lines).AreaSqm;

    /// <summary>
    /// The area and unit cost the repeated floors inherit from the request's included first floor —
    /// one rule for the save, the amount ceiling and the read (<see cref="RepeatedFloorRules.IncludedFirstFloor"/>).
    /// </summary>
    public static (decimal AreaSqm, decimal UnitCostSar) IncludedFirstFloor(
        IReadOnlyList<SaveValuationCostLineRequest> lines) =>
        RepeatedFloorRules.IncludedFirstFloor(
            lines.Select(l => (l.ItemKey, l.IsIncluded, l.AreaSqm, l.UnitCostSar)));

    // ─── optimistic concurrency (2026-11-10) ───

    /// <summary>Marker key in the error map: the refusal is a stale save (the controller answers 409 and drops the key).</summary>
    public const string ConflictKey = "_conflict";

    /// <summary>Why a stale save is refused — another tab or user saved newer cost inputs.</summary>
    public const string StaleSaveMessageAr = "حفظ مستخدم آخر تعديلات أحدث — أعد تحميل الصفحة";

    /// <summary>
    /// What: whether a cost save was built on an older copy than the stored one (two tabs overwriting
    /// each other).
    /// How it works: <paramref name="expectedUpdatedAtUtc"/> is the <c>UpdatedAtUtc</c> the screen loaded
    /// (or got back from its own last save). Null = an older client that sends nothing → no check. Empty =
    /// the screen loaded a never-saved approach → stale once a row exists. Otherwise the stored stamp must
    /// match within a millisecond (the database keeps microseconds, .NET ticks — never a false conflict).
    /// Edge cases: an unreadable stamp is not refused (tolerant, like an older client); a stored row that
    /// is gone while a stamp is expected is not a conflict (the save recreates it).
    /// </summary>
    public static bool IsStaleSave(string? expectedUpdatedAtUtc, DateTime? storedUpdatedAtUtc)
    {
        if (expectedUpdatedAtUtc is null) return false;
        if (string.IsNullOrWhiteSpace(expectedUpdatedAtUtc)) return storedUpdatedAtUtc is not null;
        if (storedUpdatedAtUtc is not { } stored) return false;
        if (!DateTime.TryParse(
                expectedUpdatedAtUtc.Trim(),
                CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                out var expected))
            return false;
        var storedUtc = stored.Kind == DateTimeKind.Local ? stored.ToUniversalTime() : stored;
        return Math.Abs((storedUtc - expected).Ticks) >= TimeSpan.TicksPerMillisecond;
    }

    /// <summary>The stamp the cost DTO hands the screen — round-trip ISO 8601 UTC; null before the first save.</summary>
    public static string? ConcurrencyStamp(DateTime? updatedAtUtc) =>
        updatedAtUtc is { } at
            ? (at.Kind == DateTimeKind.Local ? at.ToUniversalTime() : DateTime.SpecifyKind(at, DateTimeKind.Utc))
                .ToString("o", CultureInfo.InvariantCulture)
            : null;

    /// <summary>
    /// Request positions whose id is set but not one of this valuation's stored lines — the
    /// service then asks the store whether such an id belongs to another valuation.
    /// </summary>
    public static IReadOnlyList<(int Index, Guid Id)> UnknownLineIds(
        IReadOnlyList<SaveValuationCostLineRequest> lines,
        IReadOnlySet<Guid> ownLineIds) =>
        lines
            .Select((l, i) => (Index: i, Id: l.Id ?? Guid.Empty))
            .Where(x => x.Id != Guid.Empty && !ownLineIds.Contains(x.Id))
            .ToList();

    /// <summary>Latin digits, comma thousands — whatever the server culture.</summary>
    private static string N(decimal value) => value.ToString("#,0", CultureInfo.InvariantCulture);

    private static void ValidateLines(
        IReadOnlyList<SaveValuationCostLineRequest> lines,
        Dictionary<string, string> errors)
    {
        if (lines.Count > CostApproachRules.MaxLines)
        {
            errors["lines"] = $"عدد بنود التكلفة يتجاوز الحد ({CostApproachRules.MaxLines} بند)";
            return;
        }

        var firstFloorArea = FirstFloorArea(lines);
        var seenIds = new HashSet<Guid>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var itemKey = CostLineItemKeys.Normalize(line.ItemKey);
            if (line.Id is { } id && id != Guid.Empty && !seenIds.Add(id))
                errors[$"lines[{i}].id"] = "معرّف البند مكرر في الطلب — لكل بند معرّف مستقل";
            if (string.IsNullOrWhiteSpace(line.Label) && itemKey == CostLineItemKeys.Custom)
                errors[$"lines[{i}].label"] = "تسمية البند مطلوبة";
            if (line.AreaSqm < 0m)
                errors[$"lines[{i}].areaSqm"] = "الكمية يجب أن تكون ≥ 0";
            else if (line.AreaSqm > CostApproachRules.MaxLineQuantity)
                errors[$"lines[{i}].areaSqm"] =
                    $"الكمية تتجاوز الحد المعقول ({N(CostApproachRules.MaxLineQuantity)})";
            if (line.UnitCostSar < 0m)
                errors[$"lines[{i}].unitCostSar"] = "تكلفة الوحدة يجب أن تكون ≥ 0";
            else if (line.UnitCostSar > CostApproachRules.MaxUnitCostSar)
                errors[$"lines[{i}].unitCostSar"] =
                    $"تكلفة الوحدة تتجاوز الحد المعقول ({N(CostApproachRules.MaxUnitCostSar)} ر.س)";
            // Round 2: an unknown kind («xyz») is refused instead of being stored as-is.
            if (!string.IsNullOrWhiteSpace(line.StructureKind)
                && !BuildingStructureKinds.IsKnown(line.StructureKind.Trim().ToLowerInvariant()))
                errors[$"lines[{i}].structureKind"] = "نوع المكوّن غير معروف (دور / سور / ملحق / قبو / أخرى)";
            if (line.Unit is not null && !CostLineUnits.IsKnown(line.Unit))
                errors[$"lines[{i}].unit"] = "وحدة القياس غير معروفة (م² / م.ط / عدد / مقطوع)";
            if (line.BuildRatioPct is < 0m or > 100m)
                errors[$"lines[{i}].buildRatioPct"] = "نسبة البناء يجب أن تكون بين 0 و 100";
            if (line.RepeatedFloorCount is < 0 or > CostApproachRules.MaxRepeatedFloorCount)
                errors[$"lines[{i}].repeatedFloorCount"] =
                    $"عدد الأدوار المتكررة يجب أن يكون بين 1 و {CostApproachRules.MaxRepeatedFloorCount}";
            else if (itemKey == CostLineItemKeys.RepeatedFloors
                     && line.IsIncluded
                     && RepeatedFloorRules.MissingInputMessage(line.RepeatedFloorCount, firstFloorArea)
                         is { } missing)
                errors[$"lines[{i}].repeatedFloorCount"] = missing;
        }
    }

    private static void ValidateLand(
        SaveValuationCostApproachRequest request,
        Dictionary<string, string> errors)
    {
        if (request.UseRestrictionDiscountPct is < 0m or > 100m)
            errors["useRestrictionDiscountPct"] = "خصم تقييد الاستخدام يجب أن يكون بين 0 و 100";
        // The rationale alert 10 asks for is at least 10 characters once written.
        if (request.UseRestrictionDiscountPct > 0m
            && JustificationRules.IsBelowRequiredMinimum(request.UseRestrictionRationale))
            errors["useRestrictionRationale"] = JustificationRules.RequiredMinimumMessageAr("مبرر خصم تقييد الاستخدام");
        if (request.ApartmentLandShareSqm is < 0m or > CostApproachRules.MaxLandShareSqm)
            errors["apartmentLandShareSqm"] =
                $"حصة الشقة من الأرض يجب أن تكون بين 0 و {N(CostApproachRules.MaxLandShareSqm)} م²";
        // The land comparables are compared with the whole building plot.
        if (request.BuildingPlotAreaSqm is <= 0m or > CostApproachRules.MaxBuildingPlotAreaSqm)
            errors["buildingPlotAreaSqm"] =
                $"مساحة قطعة الأرض يجب أن تكون أكبر من 0 ولا تتجاوز {N(CostApproachRules.MaxBuildingPlotAreaSqm)} م²";
        else if (request.BuildingPlotAreaSqm is { } plot
                 && request.ApartmentLandShareSqm is { } share
                 && share > plot)
            errors["apartmentLandShareSqm"] =
                $"حصة الشقة من الأرض ({N2(share)} م²) لا يمكن أن تتجاوز مساحة قطعة الأرض ({N2(plot)} م²)";
    }

    private static string N2(decimal value) => value.ToString("#,0.##", CultureInfo.InvariantCulture);

    private static void ValidateIndirect(
        SaveValuationCostApproachRequest request,
        Dictionary<string, string> errors)
    {
        var items = request.IndirectItems ?? [];
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (!IndirectCostItemKeys.IsKnown(item.ItemKey))
                errors[$"indirectItems[{i}].itemKey"] = "بند غير معروف من بنود التكاليف غير المباشرة";
            else if (!seenKeys.Add(item.ItemKey))
                errors[$"indirectItems[{i}].itemKey"] = "بند مكرر";
            if (item.Pct < 0m || item.Pct > CostApproachRules.IndirectItemMaxPct)
                errors[$"indirectItems[{i}].pct"] = "النسبة يجب أن تكون بين 0 و 50";
        }

        if (request.FinancingAnnualRatePct is < 0m or > CostApproachRules.FinancingAnnualRateMaxPct)
            errors["financingAnnualRatePct"] = "المعدل السنوي يجب أن يكون بين 0 و 30";
        if (request.FinancingMonths is < 0 or > CostApproachRules.FinancingMonthsMax)
            errors["financingMonths"] = "مدة التنفيذ يجب أن تكون بين 0 و 120 شهرًا";
    }

    private static void ValidateAgeAndObsolescence(
        SaveValuationCostApproachRequest request,
        Dictionary<string, string> errors)
    {
        if (request.ActualAgeYears is < 0m or > CostApproachRules.MaxAgeYears)
            errors["actualAgeYears"] = $"العمر الفعلي يجب أن يكون بين 0 و {N(CostApproachRules.MaxAgeYears)} سنة";
        // An economic life of 0 read as «no depreciation» (0٪) — a building has some life; blank stays allowed.
        if (request.EconomicAgeYears is <= 0m or > CostApproachRules.MaxAgeYears)
            errors["economicAgeYears"] = $"العمر الاقتصادي يجب أن يكون أكبر من 0 ولا يتجاوز {N(CostApproachRules.MaxAgeYears)} سنة";
        if (request.LifeExtensionYears is < 0m or > CostApproachRules.MaxLifeExtensionYears)
            errors["lifeExtensionYears"] =
                $"تمديد العمر يجب أن يكون بين 0 و {N(CostApproachRules.MaxLifeExtensionYears)} سنة";
        if (request.FunctionalObsolescencePct is < 0m or > 100m)
            errors["functionalObsolescencePct"] = "التقادم الوظيفي يجب أن يكون بين 0 و 100";
        if (request.ExternalObsolescencePct is < 0m or > 100m)
            errors["externalObsolescencePct"] = "التقادم الخارجي يجب أن يكون بين 0 و 100";
        // The basis alert 6 asks for (life extension > 0) is at least 10 characters once written.
        if (request.LifeExtensionYears > 0m
            && JustificationRules.IsBelowRequiredMinimum(request.LifeExtensionBasis))
            errors["lifeExtensionBasis"] = JustificationRules.RequiredMinimumMessageAr("بيان أساس تمديد العمر");
        // The rationales alert 12 asks for are at least 10 characters once written.
        if (request.FunctionalObsolescencePct > 0m
            && JustificationRules.IsBelowRequiredMinimum(request.FunctionalObsolescenceRationale))
            errors["functionalObsolescenceRationale"] = JustificationRules.RequiredMinimumMessageAr("مبرر التقادم الوظيفي");
        if (request.ExternalObsolescencePct > 0m
            && JustificationRules.IsBelowRequiredMinimum(request.ExternalObsolescenceRationale))
            errors["externalObsolescenceRationale"] = JustificationRules.RequiredMinimumMessageAr("مبرر التقادم الخارجي");
    }
}
