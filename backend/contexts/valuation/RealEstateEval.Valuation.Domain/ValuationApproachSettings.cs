using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Screen 1 — governing valuation settings (v2 scoping §B-2): applied approaches control work tabs
/// and weighting rows (Q-2); land is not valued by the cost approach (Q-3).
/// One row per valuation request; absent row = defaults derived from the property type.
/// </summary>
public class ValuationApproachSettings
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }

 /// <summary>Market approach (comparison method).</summary>
    public bool MarketApproachEnabled { get; set; } = true;

 /// <summary>Cost approach (contractor method) — Q-3: not enabled for "land" type.</summary>
    public bool CostApproachEnabled { get; set; } = true;

 /// <summary>Income approach (direct capitalisation, D17) — the appraiser may enable it.</summary>
    public bool IncomeApproachEnabled { get; set; }

 /// <summary>
 /// D11: the interest valued — see <see cref="OwnershipInterestKeys"/>: full ownership as the deed states it
 /// (default), a usufruct right, or a building on leased land.
 /// </summary>
    public string OwnershipInterestKey { get; set; } = OwnershipInterestKeys.Freehold;

 /// <summary>D11: years left on the usufruct / land lease — required for those interests, empty otherwise.</summary>
    public decimal? RemainingLeaseYears { get; set; }

 /// <summary>Cost basis — see <see cref="CostBasisKeys"/>. Meaningful when cost is enabled.</summary>
    public string CostBasisKey { get; set; } = CostBasisKeys.Replacement;

 /// <summary>Cost valuation scope — see <see cref="CostScopeKeys"/>: land and building (default) or building only.</summary>
    public string CostScopeKey { get; set; } = CostScopeKeys.LandAndBuilding;

 /// <summary>Cost measurement unit — see <see cref="CostMeasurementUnitKeys"/>.</summary>
    public string CostMeasurementUnitKey { get; set; } = CostMeasurementUnitKeys.ComparisonUnit;

 /// <summary>Adjustments edit unlock — when disabled, blocks saving adjustment lines and weights.</summary>
    public bool AdjustmentsEditUnlocked { get; set; } = true;

 /// <summary>Valuation purpose (§4j-5) — auto-selected from assignment type; valuer may change. See <see cref="ValuationPurposeKeys"/>.</summary>
    public string ValuationPurposeKey { get; set; } = "";
 /// <summary>Optional purpose note (required when "other").</summary>
    public string? ValuationPurposeNote { get; set; }

 /// <summary>
 /// Specialist clause (IVS 101 1-20/l): engaging an **external** specialist on the valuation —
 /// not the assignment specialist nor the case-study specialist (internal transaction roles).
 /// "No" (default) ⟵ standard denial line in assumptions; "Yes" ⟵ required details replace it.
 /// </summary>
    public bool ExternalSpecialistUsed { get; set; }
 /// <summary>Specialist, role, and outcome — required when "Yes".</summary>
    public string? ExternalSpecialistDetails { get; set; }

 /// <summary>
 /// Valuation date — two kinds (Omar decision 2026-08-17): "value issuance" (automatic — usually report
 /// issue date) or "retrospective" set manually by the valuer with required date and rationale.
 /// </summary>
    public string ValuationDateMode { get; set; } = ValuationDateModes.Issue;
    /// <summary>Retrospective date (or period start).</summary>
    public DateOnly? RetrospectiveDate { get; set; }
    /// <summary>Retrospective period end — empty = single date.</summary>
    public DateOnly? RetrospectiveDateEnd { get; set; }
    public string? RetrospectiveRationale { get; set; }

 /// <summary>JSON — selected/added special-assumption items (frozen texts, not ids).</summary>
    public string? SelectedAssumptionsJson { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
}

/// <summary>
/// D11: the interest being valued. «ملكية تامة» prints the deed's own ownership type; «حق منفعة» and
/// «أرض مستأجرة» are leasehold interests that carry the remaining lease term (for buildings on leased land
/// the remaining economic life is capped at it).
/// </summary>
public static class OwnershipInterestKeys
{
    public const string Freehold = "freehold";
    public const string Usufruct = "usufruct";
    public const string LeasedLand = "leased_land";

    public static readonly string[] All = [Freehold, Usufruct, LeasedLand];

    /// <summary>Upper bound on the remaining lease term (years).</summary>
    public const decimal MaxRemainingLeaseYears = 999m;

    public static bool IsKnown(string? value) =>
        All.Contains((value ?? "").Trim().ToLowerInvariant(), StringComparer.Ordinal);

    /// <summary>Blank or unknown → freehold.</summary>
    public static string Normalize(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return IsKnown(v) ? v : Freehold;
    }

    /// <summary>A usufruct right or leased land — the remaining lease term applies.</summary>
    public static bool IsLeasehold(string? value) => Normalize(value) != Freehold;

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        Usufruct => "حق منفعة",
        LeasedLand => "أرض مستأجرة",
        _ => "ملكية تامة",
    };
}

/// <summary>Cost basis: replacement or reproduction (B-2 §9 field).</summary>
public static class CostBasisKeys
{
    public const string Replacement = "replacement";
    public const string Reproduction = "reproduction";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Replacement or Reproduction;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == Reproduction ? Reproduction : Replacement;

    public static string LabelAr(string? value) =>
        Normalize(value) == Reproduction ? "إعادة الإنتاج" : "الإحلال";
}

/// <summary>
/// Valuation scope, chosen by the appraiser: land only, buildings only, or land with buildings.
/// The specialist always lists the components (they print either way); the scope decides whether
/// they are valued. "Land only" = no cost approach (e.g. a derelict villa valued as land);
/// "buildings only" hides the cost land section; "land and building" values both.
/// </summary>
public static class CostScopeKeys
{
    public const string LandAndBuilding = "land_and_building";
    public const string BuildingOnly = "building_only";
    public const string LandOnly = "land_only";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is LandAndBuilding or BuildingOnly or LandOnly;

    public static string Normalize(string? value) => (value ?? "").Trim().ToLowerInvariant() switch
    {
        BuildingOnly => BuildingOnly,
        LandOnly => LandOnly,
        _ => LandAndBuilding,
    };

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        BuildingOnly => "مباني فقط",
        LandOnly => "أرض فقط",
        _ => "أرض مع المباني",
    };

    public static bool IsBuildingOnly(string? value) => Normalize(value) == BuildingOnly;

    public static bool IsLandOnly(string? value) => Normalize(value) == LandOnly;

    /// <summary>The listed components take part in the valuation (not «أرض فقط»).</summary>
    public static bool IncludesBuildings(string? value) => Normalize(value) != LandOnly;
}

/// <summary>Cost measurement unit (B-2 §10 field).</summary>
public static class CostMeasurementUnitKeys
{
    public const string ComparisonUnit = "comparison_unit";
    public const string QuantitySurvey = "quantity_survey";
    public const string LumpSum = "lump_sum";
    public const string PerItem = "per_item";

    public static readonly string[] All = [ComparisonUnit, QuantitySurvey, LumpSum, PerItem];

    public static bool IsKnown(string? value) =>
        All.Contains((value ?? "").Trim().ToLowerInvariant(), StringComparer.Ordinal);

    public static string Normalize(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return IsKnown(v) ? v : ComparisonUnit;
    }

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        QuantitySurvey => "المسح الكمي",
        LumpSum => "المبلغ المقطوع",
        PerItem => "كل بند على حدة",
        _ => "وحدة المقارنة",
    };
}

/// <summary>
/// Valuation purpose (§4j-5) — full list; default is derived from assignment type.
/// List is extensible once an official list is adopted.
/// </summary>
public static class ValuationPurposeKeys
{
    public const string JudicialExecution = "judicial_execution";
    public const string SalePurchase = "sale_purchase";
    public const string Financing = "financing";
    public const string FinancialReporting = "financial_reporting";
    public const string Litigation = "litigation";
    public const string Other = "other";
    /// <summary>Execution / estates — public auction for liquidation.</summary>
    public const string AuctionLiquidation = "auction_liquidation";
    /// <summary>Private sector — sale.</summary>
    public const string Sale = "sale";
    public const string EstateLiquidation = "estate_liquidation";
    public const string Purchase = "purchase";
    public const string Expropriation = "expropriation";

    public static readonly string[] All =
    [
        JudicialExecution, SalePurchase, Financing, FinancialReporting, Litigation, Other,
        AuctionLiquidation, Sale, EstateLiquidation, Purchase, Expropriation,
    ];

    public static bool IsKnown(string? value) =>
        All.Contains((value ?? "").Trim().ToLowerInvariant(), StringComparer.Ordinal);

    public static string LabelAr(string? value) => (value ?? "").Trim().ToLowerInvariant() switch
    {
        JudicialExecution => "تنفيذ قضائي",
        SalePurchase => "بيع أو شراء",
        Financing => "تمويل ورهن",
        FinancialReporting => "قوائم مالية",
        Litigation => "نزاع قضائي",
        Other => "أخرى",
        AuctionLiquidation => "البيع بالمزاد العلني لغرض التصفية",
        Sale => "البيع",
        EstateLiquidation => "تصفية التركات",
        Purchase => "الشراء",
        Expropriation => "نزع الملكية للمنفعة العامة",
        _ => "",
    };
}

/// <summary>Valuation-date kinds — value issuance (automatic) or retrospective (manual with rationale).</summary>
public static class ValuationDateModes
{
    public const string Issue = "issue";
    public const string Retrospective = "retrospective";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Issue or Retrospective;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == Retrospective ? Retrospective : Issue;

    public static string LabelAr(string? value) =>
        Normalize(value) == Retrospective
            ? "أثر رجعي (يحدده المقيّم)"
            : "تاريخ إصدار القيمة";
}

public static class ValuationApproachSettingsRules
{
 /// <summary>D9: minimum length of the retrospective-date rationale.</summary>
    public const int RetrospectiveRationaleMinLength = 10;

 /// <summary>
 /// D9: a retrospective date lies in the past — not after today (Riyadh) and not after the report date
 /// when one is already set. Null when acceptable (or when the bound is unknown).
 /// </summary>
    public static string? RetrospectiveDateError(DateOnly date, DateOnly? today, DateOnly? reportDate)
    {
        if (today is { } t && date > t)
            return "تاريخ التقييم بأثر رجعي لا يكون بعد تاريخ اليوم";
        if (reportDate is { } r && date > r)
            return "تاريخ التقييم بأثر رجعي لا يكون بعد تاريخ التقرير";
        return null;
    }

 /// <summary>
 /// "Land" (any classification — residential/commercial/vacant). Property types are free-ish Arabic strings
 /// from the work order, so containment is the reliable probe.
 /// </summary>
    public static bool IsLandPropertyType(string? propertyType)
    {
        var v = (propertyType ?? "")
            .Replace("أ", "ا")
            .Replace("إ", "ا")
            .Replace("آ", "ا")
            .Replace("ٱ", "ا")
            .Trim();
        return v.Contains("ارض", StringComparison.Ordinal)
            || v.Equals("land", StringComparison.OrdinalIgnoreCase);
    }

 /// <summary>
 /// Buildings can be valued by cost when the property is not land, or when land carries listed
 /// components (a fence, a room). <paramref name="hasStructuresToValue"/> = the specialist listed
 /// at least one component.
 /// </summary>
    public static bool CanEnableCostApproach(string? propertyType, bool hasStructuresToValue) =>
        hasStructuresToValue || !IsLandPropertyType(propertyType);

 /// <summary>Cost applies = buildings can be valued AND the appraiser's scope includes them.</summary>
    public static bool CostApproachApplies(
        string? propertyType,
        bool hasStructuresToValue,
        string? costScopeKey) =>
        CostScopeKeys.IncludesBuildings(costScopeKey)
        && CanEnableCostApproach(propertyType, hasStructuresToValue);

 /// <summary>
 /// Buildings take part in the valuation: components were listed and the scope is not «أرض فقط».
 /// Drives the building facts, narrative, photo budget and alerts in place of the raw flag.
 /// </summary>
    public static bool BuildingsValued(bool hasStructuresToValue, string? costScopeKey) =>
        hasStructuresToValue && CostScopeKeys.IncludesBuildings(costScopeKey);

 /// <summary>Default scope: land only for land without listed components, else land with buildings.</summary>
    public static string DefaultScope(string? propertyType, bool hasStructuresToValue) =>
        CanEnableCostApproach(propertyType, hasStructuresToValue)
            ? CostScopeKeys.LandAndBuilding
            : CostScopeKeys.LandOnly;

 /// <summary>Defaults when no row was saved yet: both current approaches on, except cost for land.</summary>
    public static ValuationApproachSettings Defaults(
        Guid valuationRequestId,
        string? propertyType,
        bool hasStructuresToValue = false) => new()
    {
        Id = Guid.Empty,
        ValuationRequestId = valuationRequestId,
        MarketApproachEnabled = true,
        CostApproachEnabled = CanEnableCostApproach(propertyType, hasStructuresToValue),
        IncomeApproachEnabled = false,
        CostBasisKey = CostBasisKeys.Replacement,
        CostScopeKey = DefaultScope(propertyType, hasStructuresToValue),
        CostMeasurementUnitKey = CostMeasurementUnitKeys.ComparisonUnit,
        AdjustmentsEditUnlocked = true,
    };

    public static Dictionary<string, string> Validate(
        bool marketEnabled,
        bool costEnabled,
        bool incomeEnabled,
        string? costBasisKey,
        string? costMeasurementUnitKey,
        string? propertyType,
        bool hasStructuresToValue = false,
        string? valuationPurposeKey = null,
        string? valuationPurposeNote = null,
        bool externalSpecialistUsed = false,
        string? externalSpecialistDetails = null,
        string? valuationDateMode = null,
        DateOnly? retrospectiveDate = null,
        IReadOnlySet<string>? allowedPurposeKeys = null,
        string? costScopeKey = null,
        DateOnly? retrospectiveDateEnd = null,
        string? retrospectiveRationale = null,
        DateOnly? today = null,
        DateOnly? reportDate = null,
        string? ownershipInterestKey = null,
        decimal? remainingLeaseYears = null)
    {
        var errors = new Dictionary<string, string>();

 // §4j-5: purpose is a list chosen by the valuer — required when saving report settings.
        var purpose = (valuationPurposeKey ?? "").Trim().ToLowerInvariant();
        if (purpose.Length == 0)
            errors["valuationPurposeKey"] = "الغرض من التقييم إلزامي";
        else if (!(allowedPurposeKeys?.Contains(purpose) ?? ValuationPurposeKeys.IsKnown(purpose)))
            errors["valuationPurposeKey"] = "الغرض من التقييم غير معروف";
        else if (purpose == ValuationPurposeKeys.Other
            && string.IsNullOrWhiteSpace(valuationPurposeNote))
        {
            errors["valuationPurposeNote"] = "توضيح الغرض إلزامي عند اختيار «أخرى»";
        }

 // Specialist clause: "Yes" requires details (specialist, role, outcome) — IVS 101.
        if (externalSpecialistUsed && string.IsNullOrWhiteSpace(externalSpecialistDetails))
            errors["externalSpecialistDetails"] = "توضيح الاستعانة بالأخصائي الخارجي إلزامي عند «نعم»";

 // Valuation date: retrospective = a date (or a period between two dates).
        if (ValuationDateModes.Normalize(valuationDateMode) == ValuationDateModes.Retrospective)
        {
            if (retrospectiveDate is null)
                errors["retrospectiveDate"] = "تاريخ التقييم بالأثر الرجعي إلزامي";
            else if (RetrospectiveDateError(retrospectiveDate.Value, today, reportDate) is { } dateError)
                errors["retrospectiveDate"] = dateError;
            if (retrospectiveDateEnd is { } end)
            {
                if (retrospectiveDate is { } start && end < start)
                    errors["retrospectiveDateEnd"] =
                        "تاريخ نهاية الفترة يجب ألا يسبق تاريخ البداية";
                else if (RetrospectiveDateError(end, today, reportDate) is { } endError)
                    errors["retrospectiveDateEnd"] = endError;
            }

            // D9: the rationale is part of the report scope — at least ten characters.
            if ((retrospectiveRationale?.Trim().Length ?? 0) < RetrospectiveRationaleMinLength)
                errors["retrospectiveRationale"] =
                    $"مبرر التقييم بأثر رجعي إلزامي ({RetrospectiveRationaleMinLength} أحرف على الأقل)";
        }

        if (!marketEnabled && !costEnabled && !incomeEnabled)
            errors["appliedApproaches"] = "يلزم تفعيل أسلوب واحد على الأقل";

        // D11: a usufruct / leased-land interest carries its remaining lease term.
        if (ownershipInterestKey is not null && ownershipInterestKey.Trim().Length > 0
            && !OwnershipInterestKeys.IsKnown(ownershipInterestKey))
        {
            errors["ownershipInterestKey"] = "نوع الملكية غير معروف (ملكية تامة / حق منفعة / أرض مستأجرة)";
        }
        else if (OwnershipInterestKeys.IsLeasehold(ownershipInterestKey))
        {
            if (remainingLeaseYears is not { } years || years <= 0m)
                errors["remainingLeaseYears"] = "المدة المتبقية من حق المنفعة / عقد إيجار الأرض (بالسنوات) إلزامية";
            else if (years > OwnershipInterestKeys.MaxRemainingLeaseYears)
                errors["remainingLeaseYears"] =
                    $"المدة المتبقية لا تتجاوز {OwnershipInterestKeys.MaxRemainingLeaseYears:0} سنة";
        }

        if (costScopeKey is not null && !CostScopeKeys.IsKnown(costScopeKey))
            errors["costScopeKey"] = "نطاق التقييم غير معروف (أرض فقط / مباني فقط / أرض مع المباني)";
        else if (CostScopeKeys.IncludesBuildings(costScopeKey)
                 && costScopeKey is not null
                 && !CanEnableCostApproach(propertyType, hasStructuresToValue))
            errors["costScopeKey"] = "لا توجد مكونات محصورة لتقييم المباني — اختر «أرض فقط» أو اطلب من الأخصائي حصرها";
        else if (CostScopeKeys.IsBuildingOnly(costScopeKey) && !costEnabled)
            errors["costApproachEnabled"] = "«مباني فقط» تُقيَّم بأسلوب التكلفة — فعّله";

        if (costEnabled && CostScopeKeys.IsLandOnly(costScopeKey))
            errors["costApproachEnabled"] = "نطاق «أرض فقط» لا يُقيَّم بالتكلفة — ألغِ أسلوب التكلفة أو غيّر النطاق";
        else if (costEnabled && !CanEnableCostApproach(propertyType, hasStructuresToValue))
            errors["costApproachEnabled"] = "ق-3: أرض بلا إنشاءات لا تُقيَّم بالتكلفة — أسلوب التكلفة لا ينطبق";

        if (costEnabled && costBasisKey is not null && !CostBasisKeys.IsKnown(costBasisKey))
            errors["costBasisKey"] = "أساس التكلفة غير معروف";

        if (costEnabled
            && costMeasurementUnitKey is not null
            && !CostMeasurementUnitKeys.IsKnown(costMeasurementUnitKey))
        {
            errors["costMeasurementUnitKey"] = "وحدة قياس التكلفة غير معروفة";
        }

        return errors;
    }

 // ─── Special assumptions (selection library managed in valuation-report tab settings) ───

    private static readonly System.Text.Json.JsonSerializerOptions AssumptionsJsonOptions = JsonDefaults.RelaxedEscaping;

 /// <summary>
 /// Specialist-denial line in the assumptions library — dropped when "external specialist engaged" is selected.
 /// </summary>
    public static bool IsNoExternalSpecialistAssumption(string? text)
    {
        var t = (text ?? "").Trim();
        return t.Contains("لم يستعن المقيّم بأي أخصائي", StringComparison.Ordinal);
    }

    public static IReadOnlyList<string> WithoutNoExternalSpecialistAssumptions(
        IEnumerable<string>? items) =>
        (items ?? [])
            .Where(x => !IsNoExternalSpecialistAssumption(x))
            .ToList();

 /// <summary>Texts are frozen with the valuation (no ids) — later library edits do not change the selection.</summary>
    public static string? SerializeAssumptions(IReadOnlyList<string> items)
    {
        var clean = items
            .Select(x => (x ?? "").Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        return clean.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(clean, AssumptionsJsonOptions);
    }

    public static IReadOnlyList<string> ParseAssumptions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

 /// <summary>
 /// Q-2: weighting rows are built from enabled approaches only — market, cost, then the D17
 /// income approach (direct capitalisation), in that order.
 /// </summary>
    public static IReadOnlyList<string> EnabledReconciliationKinds(
        bool marketEnabled,
        bool costEnabled,
        bool incomeEnabled = false)
    {
        var kinds = new List<string>();
        if (marketEnabled) kinds.Add(ValuationApproachKinds.Market);
        if (costEnabled) kinds.Add(ValuationApproachKinds.Cost);
        if (incomeEnabled) kinds.Add(ValuationApproachKinds.Income);
        return kinds;
    }
}
