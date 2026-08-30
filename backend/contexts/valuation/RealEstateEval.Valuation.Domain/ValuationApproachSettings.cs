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

 /// <summary>Income approach — formally deferred (⏸️); stored so the choice survives when opened.</summary>
    public bool IncomeApproachEnabled { get; set; }

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
/// Cost valuation scope (interactive model spec): "land and building" requires land via comparables;
/// "building only" hides the land section; approach indicator = replacement cost less depreciation.
/// </summary>
public static class CostScopeKeys
{
    public const string LandAndBuilding = "land_and_building";
    public const string BuildingOnly = "building_only";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is LandAndBuilding or BuildingOnly;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == BuildingOnly ? BuildingOnly : LandAndBuilding;

    public static string LabelAr(string? value) =>
        Normalize(value) == BuildingOnly ? "مبنى فقط" : "أرض ومبنى";

    public static bool IsBuildingOnly(string? value) => Normalize(value) == BuildingOnly;
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
 /// <summary>
 /// "Land" (any classification — residential/commercial/vacant). Property types are free-ish Arabic strings
 /// from the work order, so containment is the reliable probe.
 /// </summary>
    public static bool IsLandPropertyType(string? propertyType)
    {
        var v = (propertyType ?? "").Trim();
        return v.Contains("أرض", StringComparison.Ordinal)
            || v.Equals("land", StringComparison.OrdinalIgnoreCase);
    }

 /// <summary>
 /// Q-3 amended (v2 spec §3): land **without structures** alone is not valued by cost —
 /// land with structures (fences or annexes) opens cost for structure lines only.
 /// </summary>
    public static bool CanEnableCostApproach(string? propertyType, bool hasStructuresToValue) =>
        !IsLandPropertyType(propertyType) || hasStructuresToValue;

 /// <summary>Defaults when no row was saved yet: both current approaches on, except cost for bare land.</summary>
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
        CostScopeKey = CostScopeKeys.LandAndBuilding,
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
        string? retrospectiveRationale = null,
        IReadOnlySet<string>? allowedPurposeKeys = null,
        string? costScopeKey = null,
        DateOnly? retrospectiveDateEnd = null)
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
            if (retrospectiveDateEnd is { } end)
            {
                if (retrospectiveDate is { } start && end < start)
                    errors["retrospectiveDateEnd"] =
                        "تاريخ نهاية الفترة يجب ألا يسبق تاريخ البداية";
            }
        }

        if (!marketEnabled && !costEnabled && !incomeEnabled)
            errors["appliedApproaches"] = "يلزم تفعيل أسلوب واحد على الأقل";

        if (incomeEnabled)
            errors["incomeApproachEnabled"] = "أسلوب الدخل قيد الإنشاء — مؤجَّل رسمياً";

        if (costEnabled && !CanEnableCostApproach(propertyType, hasStructuresToValue))
            errors["costApproachEnabled"] = "ق-3: أرض بلا إنشاءات لا تُقيَّم بالتكلفة — أسلوب التكلفة لا ينطبق";

        if (costEnabled && costBasisKey is not null && !CostBasisKeys.IsKnown(costBasisKey))
            errors["costBasisKey"] = "أساس التكلفة غير معروف";

        if (costEnabled && costScopeKey is not null && !CostScopeKeys.IsKnown(costScopeKey))
            errors["costScopeKey"] = "نطاق التقييم بالتكلفة غير معروف (أرض ومبنى / مبنى فقط)";

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

 /// <summary>Q-2: weighting rows are built from enabled approaches only (income is deferred, so excluded).</summary>
    public static IReadOnlyList<string> EnabledReconciliationKinds(
        bool marketEnabled,
        bool costEnabled)
    {
        var kinds = new List<string>();
        if (marketEnabled) kinds.Add(ValuationApproachKinds.Market);
        if (costEnabled) kinds.Add(ValuationApproachKinds.Cost);
        return kinds;
    }
}
