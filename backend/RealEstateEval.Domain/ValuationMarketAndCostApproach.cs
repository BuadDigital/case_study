namespace RealEstateEval.Domain;

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
    public string? AnalysisNotes { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
}

/// <summary>الأساس المعتمد في التسويات: سعر المتر (يُضرب في المساحة) أو قيمة العقار كاملة.</summary>
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
 /// <summary>Land value = discounted unit rate × land area — recomputed on every save.</summary>
    public decimal LandValueFromMarket { get; set; }
    public DateTime? LandImportedAtUtc { get; set; }

 /// <summary>financing annual rate % (0–30).</summary>
    public decimal FinancingAnnualRatePct { get; set; }
 /// <summary>execution period in months (0–120).</summary>
    public int FinancingMonths { get; set; }

 /// <summary>. </summary>
    public decimal? ActualAgeYears { get; set; }
 /// <summary>. </summary>
    public decimal? EconomicAgeYears { get; set; }
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
 /// <summary>Quantity in the line's unit (م² for areas; م.ط/عدد/مقطوع otherwise).</summary>
    public decimal AreaSqm { get; set; }
 /// <summary>unit — see <see cref="CostLineUnits"/>.</summary>
    public string Unit { get; set; } = CostLineUnits.Sqm;
 /// <summary>نسبة البناء column (%), optional.</summary>
    public decimal? BuildRatioPct { get; set; }
 /// <summary>repeated-floors count; quantity derives from the first floor × count.</summary>
    public int? RepeatedFloorCount { get; set; }
    public decimal UnitCostSar { get; set; }
    public string Rationale { get; set; } = "";
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public ValuationCostApproach? CostApproach { get; set; }
}

/// <summary>units: م² · م.ط · عدد · مقطوع.</summary>
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

/// <summary>defined items — groups 1 (مسطحات) and 2 (تجهيزات) + custom.</summary>
public static class CostLineItemKeys
{
 // Group 1 — مسطحات المبنى والأدوار
    public const string Basement = "basement";
    public const string GroundFloor = "ground_floor";
    public const string FirstFloor = "first_floor";
    public const string RepeatedFloors = "repeated_floors";
    public const string UpperAnnex = "upper_annex";
    public const string ApartmentArea = "apartment_area";
    public const string SharedPortion = "shared_portion";
 // Group 2 — تكاليف وتجهيزات إضافية
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
        [Basement, GroundFloor, FirstFloor, RepeatedFloors, UpperAnnex, ApartmentArea, SharedPortion];

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

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        Basement => "القبو",
        GroundFloor => "الدور الأرضي",
        FirstFloor => "الدور الأول",
        RepeatedFloors => "الأدوار المتكررة",
        UpperAnnex => "الملحق العلوي",
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

 /// <summary>Sensible default unit per item (fence م.ط, elevator عدد, lump for systems).</summary>
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
}

public static class MarketOpinionRules
{
    public static decimal ComputeOpinionValue(decimal weightedPricePerSqm, decimal subjectAreaSqm)
    {
        if (subjectAreaSqm <= 0m || weightedPricePerSqm < 0m) return 0m;
        return Math.Round(weightedPricePerSqm * subjectAreaSqm, 2, MidpointRounding.AwayFromZero);
    }
}

public static class CostApproachRules
{
    public static decimal LineTotal(decimal areaSqm, decimal unitCostSar) =>
        Math.Round(Math.Max(0m, areaSqm) * Math.Max(0m, unitCostSar), 2, MidpointRounding.AwayFromZero);

    public static decimal SumDirectCost(IEnumerable<(decimal area, decimal unit, bool included)> lines) =>
        lines.Where(l => l.included).Sum(l => LineTotal(l.area, l.unit));

 /// <summary>Buildings (direct cost) + imported land .</summary>
    public static decimal CostOpinionWithLand(decimal directCostTotal, decimal landValueFromMarket) =>
        Math.Round(Math.Max(0m, directCostTotal) + Math.Max(0m, landValueFromMarket), 2, MidpointRounding.AwayFromZero);

 /// <summary>unit rate after the use-restriction discount (clamped 0–100%).</summary>
    public static decimal LandUnitRateAfterDiscount(decimal unitRateSar, decimal discountPct)
    {
        var pct = Math.Clamp(discountPct, 0m, 100m);
        return Math.Round(Math.Max(0m, unitRateSar) * (1m - pct / 100m), 2, MidpointRounding.AwayFromZero);
    }

 /// <summary>Land value from the discounted rate; apartment share overrides land area when set.</summary>
    public static decimal LandValue(decimal unitRateAfterDiscount, decimal landAreaSqm, decimal? apartmentShareSqm)
    {
        var area = apartmentShareSqm is > 0m ? apartmentShareSqm.Value : landAreaSqm;
        return Math.Round(Math.Max(0m, unitRateAfterDiscount) * Math.Max(0m, area), 2, MidpointRounding.AwayFromZero);
    }

    public static bool TryParseArea(string? areaText, out decimal area)
    {
        area = 0m;
        if (string.IsNullOrWhiteSpace(areaText)) return false;
        var normalized = areaText.Trim().Replace(',', '.');
        return decimal.TryParse(
            normalized,
            System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture,
            out area) && area >= 0m;
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

 /// <summary>depreciation on total cost; clamped 0–100% so value stays non-negative.</summary>
    public static decimal DepreciationValue(decimal totalCostWithIndirect, decimal totalObsolescencePct) =>
        Math.Round(
            Math.Max(0m, totalCostWithIndirect) * Math.Clamp(totalObsolescencePct, 0m, 100m) / 100m,
            2, MidpointRounding.AwayFromZero);

 /// <summary>buildings value after depreciation (المباني دون الأرض).</summary>
    public static decimal BuildingsAfterDepreciation(decimal totalCostWithIndirect, decimal depreciationValue) =>
        Math.Round(Math.Max(0m, totalCostWithIndirect - depreciationValue), 2, MidpointRounding.AwayFromZero);
}
