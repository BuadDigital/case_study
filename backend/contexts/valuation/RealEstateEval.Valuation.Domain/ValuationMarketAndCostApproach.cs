// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Cost ActualAgeRationale / EconomicAgeRationale stored on the cost approach.
//  • Cost A repeated-floors line needs a count and a first-floor area (RepeatedFloorRules.MissingInputMessage).
//  • Bounds Save bounds for quantity, unit cost, line count, floor count, ages, life extension and land
//           share; LineTotal clamps legacy rows so a read never overflows.
//  • The land rate inside the cost approach is always per m²: on whole_property each comparable's
//         total ÷ its own area, then weighted (LandUnitRateFromAdoptedComps).
//  • Applied obsolescence capped at 100% (buildings value floors at 0); alert above 90%.
//  • LifeCappedByLease — the life used for depreciation is at most actual age + remaining lease.
// Round 2 (1b19bedc)
//  • A    BuildingPlotAreaSqm on the cost approach and CostLandAreas (plot + apartment share); the land
//         table compares with the plot (LandTableSubjectAreaSqm) and multiplies by the share
//         (LandTableValueAreaSqm).
//  • MaxBuildingPlotAreaSqm and MaxAmountSar (1e12) — a cost line or total cannot overflow numeric(18,2).
// Grey areas (2026-11-10)
//  • CostDepreciationRules.IsIncomplete — included floor lines with a blank actual age or economic life.
//  • RepeatedFloorRules.IncludedFirstFloor — repeated floors inherit from the INCLUDED first floor only.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Per-valuation-request market-approach header: subject area drives opinion value.
/// </summary>
public class ValuationMarketApproach
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
 /// <summary>Subject property area m² — multiplies weighted unit rate (per-m² basis only).</summary>
    public decimal? SubjectAreaSqm { get; set; }
 /// <summary>one decision per valuation; changes the whole calc path.</summary>
    public string AdjustmentBasis { get; set; } = MarketAdjustmentBasisKeys.PricePerSqm;
    /// <summary>Frozen methodology coeff — area (%). Changing org defaults must not rewrite past valuations.</summary>
    public decimal AreaFactorPct { get; set; } = AreaAdjustmentRules.DefaultAreaFactorPct;
    /// <summary>Frozen methodology coeff — annual market rate (%) for market-conditions suggestion.</summary>
    public decimal AnnualMarketRatePct { get; set; } = MarketApproachRules.DefaultAnnualMarketRatePct;
    /// <summary>Frozen — market-value rounding exponent (10^n). Default 4 → nearest 10,000.</summary>
    public int ValueRoundDecimals { get; set; } = MarketApproachRules.DefaultValueRoundDecimals;
    /// <summary>
    /// True for a request already deposited (or done) when the market rounding was switched on
    /// (migration <c>MarketValueUnroundedFlag</c>, 2026-11-10): its market value stays the unrounded figure
    /// it was handed over with. Every other request — new deposits included — rounds by
    /// <see cref="ValueRoundDecimals"/>, so a deposit never changes the value afterwards.
    /// </summary>
    public bool MarketValueUnrounded { get; set; }
    public string? AnalysisNotes { get; set; }
 /// <summary>JSON — subject descriptions per difference factor (subjSpec in the interactive model).</summary>
    public string? SubjectSpecJson { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
}

/// <summary>Adjustments basis: unit price (× area) or whole-property value.</summary>
public static class MarketAdjustmentBasisKeys
{
    public const string PricePerSqm = "price_per_sqm";
    public const string WholeProperty = "whole_property";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is PricePerSqm or WholeProperty;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == WholeProperty ? WholeProperty : PricePerSqm;

    public static string LabelAr(string? value) =>
        Normalize(value) == WholeProperty
            ? "قيمة العقار المقارن (دون ضرب في المساحة)"
            : "سعر متر المقارن (يُضرب الناتج في المساحة)";

    /// <summary>
    /// The basis a new market table opens on (2026-10-29 ruling).
    /// How it works: land, by its type or by the «أرض فقط» scope, is compared per m² of land. Anything
    /// else (a villa, an عمارة, an apartment) is compared as a whole property — its price includes its
    /// land, which is not mentioned.
    /// Edge cases: a land-type deed carrying a building (أرض تجارية + مستودع) opens per m² here; the
    /// screen knows its floor area and switches it on the first area sync. A saved basis is never replaced.
    /// </summary>
    public static string DefaultFor(string? propertyType, string? costScopeKey) =>
        CostScopeKeys.IsLandOnly(costScopeKey)
        || ValuationApproachSettingsRules.IsLandPropertyType(propertyType)
            ? PricePerSqm
            : WholeProperty;
}

/// <summary>
/// Cost-approach (contractor method) header — land imported from market, not typed freely.
/// </summary>
public class ValuationCostApproach
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
 /// <summary>market weighted unit rate (SAR/m²) captured at import; locked.</summary>
    public decimal LandUnitRateFromMarket { get; set; }
 /// <summary>Land area m² snapshot from the market header at import (deed/survey single source).</summary>
    public decimal LandAreaSqm { get; set; }
 /// <summary>use-restriction discount %, default 0.</summary>
    public decimal UseRestrictionDiscountPct { get; set; }
 /// <summary>required when the discount is above zero.</summary>
    public string? UseRestrictionRationale { get; set; }
 /// <summary>apartment share of land m²; overrides land area when set.</summary>
    public decimal? ApartmentLandShareSqm { get; set; }
    /// <summary>
    /// (round 2): the whole building plot (m²) the land table inside the cost approach compares
    /// each land comparable with — for an apartment the building's land, never the unit's floor area. Kept
    /// here, apart from the market header, so the subject-area sync can never overwrite it. Null = not
    /// entered (see <see cref="CostApproachRules.LandTableSubjectAreaSqm"/>).
    /// </summary>
    public decimal? BuildingPlotAreaSqm { get; set; }
 /// <summary>Land value = discounted unit rate × land area — recomputed on every save.</summary>
    public decimal LandValueFromMarket { get; set; }
    public DateTime? LandImportedAtUtc { get; set; }

 /// <summary>financing annual rate % (0–30).</summary>
    public decimal FinancingAnnualRatePct { get; set; }
 /// <summary>execution period in months (0–120).</summary>
    public int FinancingMonths { get; set; }

 /// <summary>. </summary>
    public decimal? ActualAgeYears { get; set; }
    /// <summary>The appraiser's basis for the actual (effective) age — printed with the cost narrative.</summary>
    public string? ActualAgeRationale { get; set; }
 /// <summary>. </summary>
    public decimal? EconomicAgeYears { get; set; }
    /// <summary>The appraiser's basis for the economic life.</summary>
    public string? EconomicAgeRationale { get; set; }
 /// <summary>extension basis required when above zero.</summary>
    public decimal LifeExtensionYears { get; set; }
    public string? LifeExtensionBasis { get; set; }
 /// <summary>rationale required when above zero.</summary>
    public decimal FunctionalObsolescencePct { get; set; }
    public string? FunctionalObsolescenceRationale { get; set; }
 /// <summary>rationale required when above zero.</summary>
    public decimal ExternalObsolescencePct { get; set; }
    public string? ExternalObsolescenceRationale { get; set; }

    public string? AnalysisNotes { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
    public ICollection<ValuationCostLine> Lines { get; set; } = [];
    public ICollection<ValuationIndirectCostItem> IndirectItems { get; set; } = [];
}

/// <summary>indirect cost item: % (0–50) + rationale, amount computed.</summary>
public class ValuationIndirectCostItem
{
    public Guid Id { get; set; }
    public Guid CostApproachId { get; set; }
 /// <summary>Key from <see cref="IndirectCostItemKeys"/>.</summary>
    public string ItemKey { get; set; } = IndirectCostItemKeys.DesignSupervision;
    public decimal Pct { get; set; }
    public string? Rationale { get; set; }
    public int SortOrder { get; set; }

    public ValuationCostApproach? CostApproach { get; set; }
}

/// <summary>The six indirect items.</summary>
public static class IndirectCostItemKeys
{
    public const string DesignSupervision = "design_supervision";
    public const string LicensingFees = "licensing_fees";
    public const string ProjectManagement = "project_management";
    public const string UtilitiesConnection = "utilities_connection";
    public const string Contingency = "contingency";
    public const string DeveloperProfit = "developer_profit";

    public static readonly string[] All =
        [DesignSupervision, LicensingFees, ProjectManagement, UtilitiesConnection, Contingency, DeveloperProfit];

    public static bool IsKnown(string? value) =>
        value is DesignSupervision or LicensingFees or ProjectManagement
            or UtilitiesConnection or Contingency or DeveloperProfit;

    public static string LabelAr(string? value) => value switch
    {
        DesignSupervision => "التصميم والإشراف الهندسي",
        LicensingFees => "الترخيص والرسوم الحكومية",
        ProjectManagement => "إدارة المشروع",
        UtilitiesConnection => "توصيل الخدمات",
        Contingency => "مخصص الطوارئ",
        DeveloperProfit => "أرباح المطور والمخاطرة",
        _ => value ?? "",
    };
}

/// <summary>Direct cost line — usually seeded from building inventory; unit cost by appraiser.</summary>
public class ValuationCostLine
{
    public Guid Id { get; set; }
    public Guid CostApproachId { get; set; }
    public Guid? SourceInventoryLineId { get; set; }
    public string StructureKind { get; set; } = BuildingStructureKinds.Floor;
 /// <summary>defined item — see <see cref="CostLineItemKeys"/>; custom = free label.</summary>
    public string ItemKey { get; set; } = CostLineItemKeys.Custom;
    public string Label { get; set; } = "";
 /// <summary>Quantity in the line's unit (m² for areas; linear-m / count / lump otherwise).</summary>
    public decimal AreaSqm { get; set; }
 /// <summary>unit — see <see cref="CostLineUnits"/>.</summary>
    public string Unit { get; set; } = CostLineUnits.Sqm;
 /// <summary>Build-ratio column (%), optional.</summary>
    public decimal? BuildRatioPct { get; set; }
 /// <summary>repeated-floors count; quantity derives from the first floor × count.</summary>
    public int? RepeatedFloorCount { get; set; }
    public decimal UnitCostSar { get; set; }
    public string Rationale { get; set; } = "";
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public ValuationCostApproach? CostApproach { get; set; }
}

/// <summary>units: m² · linear-m · count · lump.</summary>
public static class CostLineUnits
{
    public const string Sqm = "sqm";
    public const string LinearMeter = "lm";
    public const string Count = "count";
    public const string LumpSum = "lump";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Sqm or LinearMeter or Count or LumpSum;

    public static string Normalize(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return IsKnown(v) ? v : Sqm;
    }

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        LinearMeter => "م.ط",
        Count => "عدد",
        LumpSum => "مقطوع",
        _ => "م²",
    };
}

/// <summary>defined items — groups 1 (floor areas) and 2 (fixtures) + custom.</summary>
public static class CostLineItemKeys
{
 // Group 1 — building floor areas and floors
    public const string Basement = "basement";
    public const string GroundFloor = "ground_floor";
    public const string FirstFloor = "first_floor";
    public const string RepeatedFloors = "repeated_floors";
    public const string UpperAnnex = "upper_annex";
    public const string LowerAnnex = "lower_annex";
    public const string ApartmentArea = "apartment_area";
    public const string SharedPortion = "shared_portion";
 // Group 2 — additional costs and fixtures
    public const string Parking = "parking";
    public const string Fence = "fence";
    public const string Pool = "pool";
    public const string CentralAc = "central_ac";
    public const string Elevator = "elevator";
    public const string Landscaping = "landscaping";
    public const string TanksPumps = "tanks_pumps";
    public const string Electromechanical = "electromechanical";
    public const string Custom = "custom";

    public static readonly string[] Group1 =
        [Basement, GroundFloor, FirstFloor, RepeatedFloors, UpperAnnex, LowerAnnex, ApartmentArea, SharedPortion];

    public static readonly string[] Group2 =
        [Parking, Fence, Pool, CentralAc, Elevator, Landscaping, TanksPumps, Electromechanical];

    public static bool IsKnown(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return v == Custom || Group1.Contains(v) || Group2.Contains(v);
    }

    public static string Normalize(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return IsKnown(v) ? v : Custom;
    }

    /// <summary>
    /// Group 1 (building floor areas) — a defined area item, or a custom line that is a floor,
    /// an annex or a basement: by its structure kind, or — saved as «other» / no kind — by its name
    /// (<see cref="AreaKindForName"/>). Everything else is group 2 (additions).
    /// How it works: mirrors `costGroupOf` in packages/app-shared/src/domain/cost-items.ts.
    /// Edge cases: fixed 2026-11-04 (A→Z #30/#52/#65/#90): only a custom line of kind «floor»
    /// counted, so «الدور الثاني», «ملحق علوي» and «الميزانين» (saved as «other») fell into the
    /// additions, needed a rationale and dropped out of the building floor areas; a custom annex or
    /// basement did too. A fence stays an addition whatever its name.
    /// </summary>
    public static bool IsAreaGroup(string? itemKey, string? structureKind, string? label = null)
    {
        var key = Normalize(itemKey);
        if (key != Custom) return Group1.Contains(key);
        var kind = (structureKind ?? "").Trim().ToLowerInvariant();
        if (kind is BuildingStructureKinds.Floor or BuildingStructureKinds.Annex or BuildingStructureKinds.Basement)
            return true;
        return (kind.Length == 0 || kind == BuildingStructureKinds.Other) && AreaKindForName(label) is not null;
    }

    private static readonly string[] FloorNameWords =
    [
        "دور", "ادوار", "طابق", "طوابق", "ميزانين", "ميزانيين", "مزانين",
        "ارضي", "علوي", "اول", "ثاني", "ثالث", "رابع", "خامس", "سادس", "سابع", "ثامن", "تاسع", "عاشر",
        "محل", "مكتب", "معرض", "وحده", "شقه", "مستودع", "هنجر", "ورشه", "مصنع",
    ];

    private static readonly string[] AnnexNameWords = ["ملحق", "ملاحق", "سطح"];
    private static readonly string[] BasementNameWords = ["قبو", "بدروم", "سرداب"];
    private static readonly string[] AreaNamePrefixes = ["مسطح", "مسطحات", "مساحه"];

    /// <summary>
    /// The inventory kind (floor / annex / basement) an item name means when it names a building
    /// area — «الدور الثاني», «طابق ثالث», «الميزانين», «مساحة المحل», «ملحق علوي», «البدروم» — else null
    /// («غرفة حارس», «المسبح», «دورة مياه»).
    /// How it works: hamza / taa marbuta / alef maqsura forms and diacritics are folded, every
    /// word's «ال» is dropped, and the first word (after an optional «مسطح / مساحة») is looked up.
    /// Mirrors `areaKindForItemName` in packages/app-shared/src/domain/cost-items.ts.
    /// Edge cases: whole-word match only, so «دورة مياه», «مكتبة» and «عزل السطح» are not areas.
    /// </summary>
    public static string? AreaKindForName(string? name)
    {
        var words = FoldArabicName(name)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.StartsWith("ال", StringComparison.Ordinal) && w.Length > 2 ? w[2..] : w)
            .ToArray();
        if (words.Length == 0) return null;
        var first = AreaNamePrefixes.Contains(words[0]) ? words.ElementAtOrDefault(1) : words[0];
        if (first is null) return null;
        if (FloorNameWords.Contains(first)) return BuildingStructureKinds.Floor;
        if (AnnexNameWords.Contains(first)) return BuildingStructureKinds.Annex;
        if (BasementNameWords.Contains(first)) return BuildingStructureKinds.Basement;
        return null;
    }

    /// <summary>Folds hamza / taa marbuta / alef maqsura forms and drops diacritics; whitespace → one space.</summary>
    private static string FoldArabicName(string? value)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var ch in (value ?? "").Trim())
        {
            if (ch is >= '\u064B' and <= '\u065F' or '\u0670') continue;
            sb.Append(ch switch
            {
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ة' => 'ه',
                'ى' => 'ي',
                _ => char.IsWhiteSpace(ch) ? ' ' : ch,
            });
        }

        return sb.ToString();
    }

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        Basement => "القبو",
        GroundFloor => "الدور الأرضي",
        FirstFloor => "الدور الأول",
        RepeatedFloors => "الأدوار المتكررة",
        UpperAnnex => "الملحق العلوي",
        LowerAnnex => "الملحق الأرضي",
        ApartmentArea => "مساحة الشقة",
        SharedPortion => "حصة المشترك من المبنى",
        Parking => "المواقف",
        Fence => "السور",
        Pool => "المسبح",
        CentralAc => "التكييف المركزي",
        Elevator => "المصعد",
        Landscaping => "تشجير وتنسيق الموقع",
        TanksPumps => "خزانات ومضخات",
        Electromechanical => "أعمال كهروميكانيكية",
        _ => "بند مخصص",
    };

 /// <summary>Sensible default unit per item (fence linear-m, elevator count, lump for systems).</summary>
    public static string DefaultUnit(string? value) => Normalize(value) switch
    {
        Fence => CostLineUnits.LinearMeter,
        Elevator or Parking => CostLineUnits.Count,
        CentralAc or Landscaping or TanksPumps or Electromechanical or Pool => CostLineUnits.LumpSum,
        _ => CostLineUnits.Sqm,
    };
}

/// <summary>repeated-floors quantity derives from the first-floor area × count.</summary>
public static class RepeatedFloorRules
{
    public static decimal DeriveQuantity(decimal firstFloorAreaSqm, int repeatedCount) =>
        Math.Round(
            Math.Max(0m, firstFloorAreaSqm) * Math.Max(0, repeatedCount),
            2, MidpointRounding.AwayFromZero);

    /// <summary>
    /// Repeated-floors area is always derived. Missing count or first-floor area
    /// yields 0 so a stale stored quantity cannot overstate the direct cost.
    /// </summary>
    public static decimal QuantityForLine(decimal firstFloorAreaSqm, int? repeatedCount)
    {
        if (repeatedCount is not { } count || count <= 0 || firstFloorAreaSqm <= 0m)
            return 0m;
        return DeriveQuantity(firstFloorAreaSqm, count);
    }

    /// <summary>
    /// Why an included repeated-floors line cannot be priced, or null when it can: the count
    /// must be at least one and an included «الدور الأول» must carry an area — the save refuses
    /// the line instead of silently pricing it at zero.
    /// Edge cases (2026-11-10): <paramref name="firstFloorAreaSqm"/> is the INCLUDED first floor's
    /// (<see cref="IncludedFirstFloor"/>), so an excluded first floor reads as missing and the message
    /// says to include it.
    /// </summary>
    public static string? MissingInputMessage(int? repeatedCount, decimal firstFloorAreaSqm)
    {
        if (repeatedCount is not > 0)
            return "أدخل عدد الأدوار المتكررة (دور واحد على الأقل) — بدونه تُحسب كمية البند صفرًا";
        if (firstFloorAreaSqm <= 0m)
            return "كمية الأدوار المتكررة تُشتقّ من مسطح «الدور الأول» المدرج في التكلفة — أدرج بند الدور الأول بمسطحه أو استبعد بند الأدوار المتكررة";
        return null;
    }

    /// <summary>
    /// What: the area and unit cost «الأدوار المتكررة» inherit — those of the first INCLUDED
    /// «الدور الأول» line; (0, 0) when there is none.
    /// How it works: the first line, in the order given, whose key normalizes to first_floor and
    /// that is included. The area is the line's own typed area (before its build ratio) — the
    /// repeated-floors line applies its OWN build ratio on top, as the save, the specialist's
    /// components table and the Infath sheet always did; applying the first floor's ratio too would
    /// count it twice.
    /// Edge cases: fixed 2026-11-10 — the save and the read took the first first_floor line whether or
    /// not it was ticked, so an excluded first floor still priced the repeated floors. Now an excluded
    /// or missing first floor gives nothing: the repeated line keeps its own unit cost, its area is 0
    /// and the save names the missing input (<see cref="MissingInputMessage"/>).
    /// Mirrors `includedFirstFloorLine` in the evaluator's cost-line-math.ts.
    /// </summary>
    public static (decimal AreaSqm, decimal UnitCostSar) IncludedFirstFloor(
        IEnumerable<(string? ItemKey, bool IsIncluded, decimal AreaSqm, decimal UnitCostSar)> lines)
    {
        foreach (var line in lines)
        {
            if (line.IsIncluded && CostLineItemKeys.Normalize(line.ItemKey) == CostLineItemKeys.FirstFloor)
                return (line.AreaSqm, line.UnitCostSar);
        }

        return (0m, 0m);
    }
}

public static class MarketOpinionRules
{
    /// <summary>Unit price × area — before adjustments-basis rounding.</summary>
    public static decimal ComputeOpinionValue(decimal weightedPricePerSqm, decimal subjectAreaSqm)
    {
        if (subjectAreaSqm <= 0m || weightedPricePerSqm < 0m) return 0m;
        return Math.Round(weightedPricePerSqm * subjectAreaSqm, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Adjustments logic: marketValue = round(landValRaw / 10^decimals) × 10^decimals.
    /// decimals=0 → nearest riyal; default 4 → nearest 10,000.
    /// </summary>
    public static decimal RoundMarketValue(
        decimal landValRaw,
        int decimals = MarketApproachRules.DefaultValueRoundDecimals)
    {
        var d = Math.Clamp(decimals, 0, 6);
        if (d == 0)
            return Math.Round(landValRaw, MidpointRounding.AwayFromZero);
        var power = 1m;
        for (var i = 0; i < d; i++) power *= 10m;
        return Math.Round(landValRaw / power, MidpointRounding.AwayFromZero) * power;
    }

}

/// <summary>
/// What the land table inside the cost approach reads from the cost approach — the whole
/// building plot (area-adjustment base) and the apartment's share of it (value multiplier), in m².
/// </summary>
public readonly record struct CostLandAreas(decimal? BuildingPlotAreaSqm, decimal? ApartmentShareSqm);

public static class CostApproachRules
{
    // ─── input bounds (the save refuses anything above; reads clamp legacy rows) ───

    /// <summary>Largest quantity one cost line may carry (m² / linear-m / count).</summary>
    public const decimal MaxLineQuantity = 10_000_000m;
    /// <summary>Largest unit cost (SAR) — a lump-sum line carries its whole amount here.</summary>
    public const decimal MaxUnitCostSar = 1_000_000_000m;
    /// <summary>Most direct-cost lines one valuation may hold.</summary>
    public const int MaxLines = 200;
    /// <summary>Most repeated floors one line may count.</summary>
    public const int MaxRepeatedFloorCount = 200;
    /// <summary>Largest actual or economic age (years).</summary>
    public const decimal MaxAgeYears = 200m;
    /// <summary>Largest life extension (years).</summary>
    public const decimal MaxLifeExtensionYears = 100m;
    /// <summary>Largest apartment land share (m²).</summary>
    public const decimal MaxLandShareSqm = 10_000_000m;
    /// <summary>Largest building plot area (m²) the land table may compare with.</summary>
    public const decimal MaxBuildingPlotAreaSqm = 10_000_000m;
    /// <summary>
    /// Largest amount (SAR) one cost line (quantity × unit cost) or the cost total may reach — keeps
    /// every stored value (numeric(18,2)) and the reconciliation's approach value far from overflow.
    /// </summary>
    public const decimal MaxAmountSar = 1_000_000_000_000m;

    /// <summary>
    /// Depreciation never exceeds the cost — the total obsolescence applied to the cost is
    /// capped here (buildings value floors at zero).
    /// </summary>
    public const decimal MaxAppliedObsolescencePct = 100m;

    /// <summary>
    /// Total obsolescence (physical + functional + external) above this asks for a written
    /// rationale — the methodology alert reads <see cref="ObsolescenceNeedsAlert"/>.
    /// </summary>
    public const decimal HighObsolescenceAlertPct = 90m;

    /// <summary>True when the (unclamped) total obsolescence calls for the high-obsolescence alert.</summary>
    public static bool ObsolescenceNeedsAlert(decimal totalObsolescencePct) =>
        totalObsolescencePct > HighObsolescenceAlertPct;

    /// <summary>
    /// Quantity × unit cost. Inputs are clamped to the save bounds so a legacy out-of-range
    /// row can never overflow the read (the screen, reconciliation and gates keep loading).
    /// </summary>
    public static decimal LineTotal(decimal areaSqm, decimal unitCostSar) =>
        Math.Round(
            Math.Clamp(areaSqm, 0m, MaxLineQuantity) * Math.Clamp(unitCostSar, 0m, MaxUnitCostSar),
            2,
            MidpointRounding.AwayFromZero);

    /// <summary>
    /// The build-ratio input exists only on m² lines of the area group (group 1); on any other
    /// line a stored ratio (e.g. seeded from inventory onto an «other» line) is ignored.
    /// How it works: <see cref="CostLineItemKeys.IsAreaGroup"/> with the line's label, so a custom
    /// «الدور الثاني» takes its ratio like a catalog floor (2026-11-04, A→Z #65).
    /// </summary>
    public static bool BuildRatioApplies(string? itemKey, string? structureKind, string? unit, string? label = null) =>
        CostLineItemKeys.IsAreaGroup(itemKey, structureKind, label)
        && CostLineUnits.Normalize(unit) == CostLineUnits.Sqm;

 /// <summary>
 /// Interactive model spec: build ratio applies to quantity for area-group m² lines (empty =
 /// 100%) — "effective floor area" enters the total and building floor areas.
 /// </summary>
    public static decimal EffectiveQuantity(
        decimal quantity,
        string? unit,
        decimal? buildRatioPct,
        string? itemKey,
        string? structureKind,
        string? label = null)
    {
        var q = Math.Max(0m, quantity);
        if (!BuildRatioApplies(itemKey, structureKind, unit, label)) return q;
        if (buildRatioPct is not { } bp) return q;
        var pct = Math.Clamp(bp, 0m, 100m);
        return Math.Round(q * pct / 100m, 2, MidpointRounding.AwayFromZero);
    }

 /// <summary>
 /// Interactive model spec: "repeating floors" with empty/zero unit cost inherits "first floor" m² rate.
 /// </summary>
    public static decimal InheritedUnitCost(
        string? itemKey,
        decimal unitCostSar,
        decimal firstFloorUnitCostSar)
    {
        if (CostLineItemKeys.Normalize(itemKey) == CostLineItemKeys.RepeatedFloors
            && unitCostSar <= 0m
            && firstFloorUnitCostSar > 0m)
        {
            return firstFloorUnitCostSar;
        }

        return Math.Max(0m, unitCostSar);
    }

    public static decimal SumDirectCost(IEnumerable<(decimal area, decimal unit, bool included)> lines) =>
        lines.Where(l => l.included).Sum(l => LineTotal(l.area, l.unit));

 /// <summary>Unit rate after indirects per line: total × (1 + indirect%) ÷ quantity.</summary>
    public static decimal NetUnitRateWithIndirect(decimal lineTotal, decimal quantity, decimal indirectSumPct)
    {
        if (lineTotal <= 0m || quantity <= 0m) return 0m;
        return Math.Round(
            lineTotal * (1m + Math.Max(0m, indirectSumPct) / 100m) / quantity,
            2, MidpointRounding.AwayFromZero);
    }

 /// <summary>
 /// Interactive model spec (costCompute): costValue = landPart + netValue always —
 /// unvalued land enters as zero (landPart = 0); the partial indicator shows and adoption is blocked
 /// by gates, not by zeroing the value. "Building only" = netValue alone.
 /// </summary>
    public static decimal CostOpinionForScope(
        decimal buildingsAfterDepreciation,
        decimal landValue,
        bool landEstimateComplete,
        bool buildingOnlyScope)
    {
        var landPart = !buildingOnlyScope && landEstimateComplete
            ? Math.Max(0m, landValue)
            : 0m;
        return Math.Round(
            buildingsAfterDepreciation + landPart,
            2,
            MidpointRounding.AwayFromZero);
    }

 /// <summary>Land (when complete, else zero) + buildings after depreciation — no wholesale zeroing.</summary>
    public static decimal CostOpinionWithLand(
        decimal buildingsAfterDepreciation,
        decimal landValue,
        bool landEstimateComplete) =>
        CostOpinionForScope(buildingsAfterDepreciation, landValue, landEstimateComplete, buildingOnlyScope: false);

 /// <summary>unit rate after the use-restriction discount (clamped 0–100%).</summary>
    public static decimal LandUnitRateAfterDiscount(decimal unitRateSar, decimal discountPct)
    {
        var pct = Math.Clamp(discountPct, 0m, 100m);
        return Math.Round(Math.Max(0m, unitRateSar) * (1m - pct / 100m), 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// The land inside the cost approach is always valued per m². Each adopted land
    /// comparable's adjusted amount becomes its own unit rate — on a whole_property table the
    /// adjusted total is divided by THAT comparable's area (never the subject's, which
    /// overstated the rate whenever the sizes differed) — and the rates are weighted.
    /// </summary>
    public static decimal LandUnitRateFromAdoptedComps(
        IEnumerable<(decimal AdjustedAmount, decimal ComparableAreaSqm, decimal WeightPct)> adopted,
        string? adjustmentBasis)
    {
        var whole = MarketAdjustmentBasisKeys.Normalize(adjustmentBasis)
            == MarketAdjustmentBasisKeys.WholeProperty;
        var rows = adopted
            .Select(r =>
            {
                var amount = Math.Max(0m, r.AdjustedAmount);
                var rate = !whole
                    ? amount
                    : r.ComparableAreaSqm > 0m ? amount / r.ComparableAreaSqm : 0m;
                return (rate, Math.Max(0m, r.WeightPct));
            })
            .ToList();
        return MarketApproachRules.WeightedUnitRate(rows);
    }

    /// <summary>
    /// The area the land table's area adjustment compares each land comparable with — the
    /// building plot saved on the cost approach. Without one, a property whose land is shared (an apartment
    /// share is set) has no usable area (null → the land estimate stays incomplete until the plot is
    /// entered: the unit's floor area is not land). Land keeps the market header's subject area, which
    /// is its deed (land) area.
    /// Edge cases (2026-10-29): a building's market header holds its floor area, so a built subject
    /// never falls back to it — null until the plot is saved (the cost screen seeds it from the deed).
    /// </summary>
    public static decimal? LandTableSubjectAreaSqm(
        decimal? buildingPlotAreaSqm,
        decimal? apartmentShareSqm,
        decimal? headerSubjectAreaSqm,
        bool headerIsLandArea = true) =>
        buildingPlotAreaSqm is > 0m ? buildingPlotAreaSqm
        : apartmentShareSqm is > 0m ? null
        : headerIsLandArea ? headerSubjectAreaSqm
        : null;

    /// <summary>
    /// The area the land table's adjusted rate multiplies into the land value — the apartment's
    /// share of the land when set, else the plot itself; null while the plot is unknown.
    /// </summary>
    public static decimal? LandTableValueAreaSqm(decimal? plotAreaSqm, decimal? apartmentShareSqm) =>
        plotAreaSqm is not > 0m ? null
        : apartmentShareSqm is > 0m ? apartmentShareSqm
        : plotAreaSqm;

 /// <summary>Land value from the discounted rate; apartment share overrides land area when set.</summary>
    public static decimal LandValue(decimal unitRateAfterDiscount, decimal landAreaSqm, decimal? apartmentShareSqm)
    {
        var area = apartmentShareSqm is > 0m ? apartmentShareSqm.Value : landAreaSqm;
        return Math.Round(Math.Max(0m, unitRateAfterDiscount) * Math.Max(0m, area), 2, MidpointRounding.AwayFromZero);
    }

    public static bool TryParseArea(string? areaText, out decimal area)
    {
        // The one typed-number rule (LocaleNumber — same as the screens); a negative area is refused.
        area = 0m;
        if (!LocaleNumber.TryParse(areaText, out var parsed) || parsed < 0m) return false;
        area = parsed;
        return true;
    }

 // ─── indirect costs ───

    public const decimal IndirectItemMaxPct = 50m;
    public const decimal FinancingAnnualRateMaxPct = 30m;
    public const int FinancingMonthsMax = 120;

 /// <summary>financing % = annual rate × (months ÷ 12) × 50%.</summary>
    public static decimal FinancingPct(decimal annualRatePct, int months) =>
        Math.Round(
            Math.Max(0m, annualRatePct) * (Math.Max(0, months) / 12m) * 0.5m,
            4, MidpointRounding.AwayFromZero);

 /// <summary>sum of item %s plus the financing %.</summary>
    public static decimal IndirectSumPct(IEnumerable<decimal> itemPcts, decimal financingPct) =>
        Math.Round(itemPcts.Sum(p => Math.Max(0m, p)) + Math.Max(0m, financingPct), 4, MidpointRounding.AwayFromZero);

 /// <summary>Per-item computed amount from the direct-cost base.</summary>
    public static decimal IndirectItemAmount(decimal directCostTotal, decimal pct) =>
        Math.Round(Math.Max(0m, directCostTotal) * Math.Max(0m, pct) / 100m, 2, MidpointRounding.AwayFromZero);

 /// <summary>total cost = direct × (1 + indirect sum).</summary>
    public static decimal TotalCostWithIndirect(decimal directCostTotal, decimal indirectSumPct) =>
        Math.Round(Math.Max(0m, directCostTotal) * (1m + Math.Max(0m, indirectSumPct) / 100m), 2, MidpointRounding.AwayFromZero);

 // ─── age / depreciation ───

 /// <summary>Extended life = economic age + extension (basis mandatory when extended).</summary>
    public static decimal ExtendedLifeYears(decimal? economicAgeYears, decimal lifeExtensionYears) =>
        Math.Max(0m, economicAgeYears ?? 0m) + Math.Max(0m, lifeExtensionYears);

 /// <summary>physical obsolescence = actual ÷ extended life. Unclamped so alert 3 can see &gt; 100%.</summary>
    public static decimal? PhysicalObsolescencePct(decimal? actualAgeYears, decimal extendedLifeYears)
    {
        if (actualAgeYears is not { } actual || extendedLifeYears <= 0m) return null;
        return Math.Round(Math.Max(0m, actual) / extendedLifeYears * 100m, 2, MidpointRounding.AwayFromZero);
    }

 /// <summary>physical + functional + external. Unclamped so alert 4 can see &gt; 100%.</summary>
    public static decimal TotalObsolescencePct(decimal? physicalPct, decimal functionalPct, decimal externalPct) =>
        Math.Round((physicalPct ?? 0m) + Math.Max(0m, functionalPct) + Math.Max(0m, externalPct), 2, MidpointRounding.AwayFromZero);

    /// <summary>The obsolescence actually applied to the cost — 0–100%.</summary>
    public static decimal AppliedObsolescencePct(decimal totalObsolescencePct) =>
        Math.Clamp(totalObsolescencePct, 0m, MaxAppliedObsolescencePct);

    /// <summary>
    /// Depreciation = cost × applied obsolescence, the total capped at 100% so the
    /// depreciation never exceeds the cost. The unclamped total still feeds the alerts.
    /// </summary>
    public static decimal DepreciationValue(decimal totalCostWithIndirect, decimal totalObsolescencePct) =>
        Math.Round(
            Math.Max(0m, totalCostWithIndirect) * AppliedObsolescencePct(totalObsolescencePct) / 100m,
            2, MidpointRounding.AwayFromZero);

    /// <summary>Buildings value after depreciation (buildings without land) — floors at zero.</summary>
    public static decimal BuildingsAfterDepreciation(decimal totalCostWithIndirect, decimal depreciationValue) =>
        Math.Max(0m, Math.Round(totalCostWithIndirect - depreciationValue, 2, MidpointRounding.AwayFromZero));

    /// <summary>
    /// A building valued alone on leased land cannot outlive the lease — its remaining
    /// economic life (life − actual age) is capped at the remaining lease years, i.e. the life
    /// used for physical depreciation is at most actual age + remaining lease. Null lease years
    /// (not leased, or not entered) leave the life unchanged.
    /// </summary>
    public static decimal LifeCappedByLease(
        decimal extendedLifeYears,
        decimal? actualAgeYears,
        decimal? remainingLeaseYears)
    {
        if (remainingLeaseYears is not { } lease || lease < 0m) return extendedLifeYears;
        var cap = Math.Max(0m, actualAgeYears ?? 0m) + lease;
        return Math.Min(extendedLifeYears, cap);
    }
}

/// <summary>
/// Whether the cost approach's depreciation can be computed at all. The save stays tolerant (an
/// autosave never fails on a blank age; <see cref="CostApproachRules.PhysicalObsolescencePct"/> then
/// gives null and the total silently counts 0٪), so the gates and the methodology alerts ask here
/// instead of trusting a 0٪ that nobody entered.
/// </summary>
public static class CostDepreciationRules
{
    /// <summary>The message the cost screen, the alert and the gate show while the ages are blank.</summary>
    public const string IncompleteMessageAr = "أدخل العمر الفعلي والعمر الاقتصادي لحساب الإهلاك";

    /// <summary>
    /// What: true when the cost approach prices buildings — at least one included line in the
    /// building floor-areas group (floors, annexes, basements; <see cref="CostLineItemKeys.IsAreaGroup"/>)
    /// — while the actual age or the economic life is blank.
    /// How it works: blank = null (the screen sends an empty box as null, never 0). A 0 actual age is a
    /// real answer (a new building); a 0 economic life is refused by the save, so it never reaches here.
    /// Edge cases (2026-11-10): the screen used to seed 10 / 40 years that nobody chose and the first
    /// autosave stored them; without them a blank age silently meant no depreciation. Additions only
    /// (fence, pool…) or excluded floors do not need the ages; a land-only approach has no lines.
    /// </summary>
    public static bool IsIncomplete(
        decimal? actualAgeYears,
        decimal? economicAgeYears,
        IEnumerable<(string? ItemKey, string? StructureKind, string? Label, bool IsIncluded)> lines)
    {
        if (actualAgeYears is not null && economicAgeYears is not null) return false;
        return lines.Any(l => l.IsIncluded && CostLineItemKeys.IsAreaGroup(l.ItemKey, l.StructureKind, l.Label));
    }

    /// <summary>
    /// The same rule over the stored cost approach and its lines. A never-saved approach (null) has no lines — false.
    /// </summary>
    public static bool IsIncomplete(ValuationCostApproach? costApproach) =>
        costApproach is not null
        && IsIncomplete(
            costApproach.ActualAgeYears,
            costApproach.EconomicAgeYears,
            costApproach.Lines.Select(l => ((string?)l.ItemKey, (string?)l.StructureKind, (string?)l.Label, l.IsIncluded)));
}
