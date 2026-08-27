namespace RealEstateEval.Domain;

/// <summary>
/// شاشة 1 — إعدادات التقييم الحاكمة (حصر v2 §ب-2): الأساليب المطبَّقة تتحكم بتبويبات
/// العمل وصفوف الترجيح (ق-2)، والأرض لا تُقيَّم بالتكلفة (ق-3).
/// One row per valuation request; absent row = defaults derived from the property type.
/// </summary>
public class ValuationApproachSettings
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }

 /// <summary>أسلوب السوق (طريقة المقارنة).</summary>
    public bool MarketApproachEnabled { get; set; } = true;

 /// <summary>أسلوب التكلفة (طريقة المقاول) — ق-3: لا يُفعَّل لنوع «أرض».</summary>
    public bool CostApproachEnabled { get; set; } = true;

 /// <summary>أسلوب الدخل — مؤجَّل رسمياً (⏸️)؛ يُخزَّن ليصمد القرار عند فتحه.</summary>
    public bool IncomeApproachEnabled { get; set; }

 /// <summary>أساس التكلفة — see <see cref="CostBasisKeys"/>. Meaningful when cost is enabled.</summary>
    public string CostBasisKey { get; set; } = CostBasisKeys.Replacement;

 /// <summary>نطاق التقييم بالتكلفة — see <see cref="CostScopeKeys"/>: أرض ومبنى (الافتراضي) أو مبنى فقط.</summary>
    public string CostScopeKey { get; set; } = CostScopeKeys.LandAndBuilding;

 /// <summary>وحدة قياس التكلفة — see <see cref="CostMeasurementUnitKeys"/>.</summary>
    public string CostMeasurementUnitKey { get; set; } = CostMeasurementUnitKeys.ComparisonUnit;

 /// <summary>صلاحية تحرير التسويات — معطّلة تمنع حفظ بنود التسوية والأوزان.</summary>
    public bool AdjustmentsEditUnlocked { get; set; } = true;

 /// <summary>الغرض من التقييم (§4ج-5) — يُختار تلقائياً من نوع الإسناد ويمكن للمقيّم تعديله. See <see cref="ValuationPurposeKeys"/>.</summary>
    public string ValuationPurposeKey { get; set; } = "";
 /// <summary>توضيح اختياري للغرض (إلزامي عند «أخرى»).</summary>
    public string? ValuationPurposeNote { get; set; }

 /// <summary>
 /// بند الأخصائي (IVS 101 1-20/ل): الاستعانة بأخصائي **خارجي** في مهمة التقييم —
 /// لا يُقصد به أخصائي الإسناد ولا أخصائي دراسة الحالة (أدوار داخلية في سير المعاملة).
 /// «لا» (الافتراضي) ⟵ بند النفي القياسي في الافتراضات؛ «نعم» ⟵ التوضيح الإلزامي يحل محله.
 /// </summary>
    public bool ExternalSpecialistUsed { get; set; }
 /// <summary>الأخصائي ودوره ونتيجته — إلزامي عند «نعم».</summary>
    public string? ExternalSpecialistDetails { get; set; }

 /// <summary>
 /// تاريخ التقييم — نوعان (قرار عمر 2026-08-17): «إصدار القيمة» (آلي — غالباً تاريخ
 /// إصدار التقرير) أو «أثر رجعي» يحدده المقيّم يدوياً بتاريخ ومبرر إلزاميين.
 /// </summary>
    public string ValuationDateMode { get; set; } = ValuationDateModes.Issue;
    public DateOnly? RetrospectiveDate { get; set; }
    public string? RetrospectiveRationale { get; set; }

 /// <summary>JSON — بنود الافتراضات الخاصة المنتقاة/المضافة (نصوص مجمّدة لا معرفات).</summary>
    public string? SelectedAssumptionsJson { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
}

/// <summary>أساس التكلفة: الإحلال أو إعادة الإنتاج (حقل ب-2 §9).</summary>
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
/// نطاق التقييم بالتكلفة (مواصفة النموذج التفاعلي): «أرض ومبنى» يستلزم تقدير الأرض بالمقارنات؛
/// «مبنى فقط» يخفي قسم الأرض ويجعل مؤشر الأسلوب = تكلفة الإحلال ناقصاً الإهلاك.
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

/// <summary>وحدة قياس التكلفة (حقل ب-2 §10).</summary>
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
/// الغرض من التقييم (§4ج-5) — قائمة كاملة؛ القيمة الافتراضية تُشتق من نوع الإسناد.
/// القائمة قابلة للتوسعة عند اعتماد قائمة رسمية.
/// </summary>
public static class ValuationPurposeKeys
{
    public const string JudicialExecution = "judicial_execution";
    public const string SalePurchase = "sale_purchase";
    public const string Financing = "financing";
    public const string FinancialReporting = "financial_reporting";
    public const string Litigation = "litigation";
    public const string Other = "other";
    /// <summary>تنفيذ / تركات — البيع بالمزاد العلني لغرض التصفية.</summary>
    public const string AuctionLiquidation = "auction_liquidation";
    /// <summary>قطاع خاص — البيع.</summary>
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

/// <summary>نوعا تاريخ التقييم — إصدار القيمة (آلي) أو أثر رجعي (يدوي بمبرر).</summary>
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
 /// «أرض» (بأي تصنيف — سكنية/تجارية/فضاء). Property types are free-ish Arabic strings
 /// from the work order, so containment is the reliable probe.
 /// </summary>
    public static bool IsLandPropertyType(string? propertyType)
    {
        var v = (propertyType ?? "").Trim();
        return v.Contains("أرض", StringComparison.Ordinal)
            || v.Equals("land", StringComparison.OrdinalIgnoreCase);
    }

 /// <summary>
 /// ق-3 المعدَّل (مواصفة v2 §3): أرض **بلا إنشاءات** وحدها لا تُقيَّم بالتكلفة —
 /// أرض بإنشاءات (كسور أو ملاحق) تفتح التكلفة لبنود الإنشاءات فقط.
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
        string? costScopeKey = null)
    {
        var errors = new Dictionary<string, string>();

 // §4ج-5: الغرض قائمة يختارها المقيّم — إلزامي عند حفظ إعدادات التقرير.
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

 // بند الأخصائي: «نعم» تستلزم التوضيح (الأخصائي، دوره، نتيجته) — IVS 101.
        if (externalSpecialistUsed && string.IsNullOrWhiteSpace(externalSpecialistDetails))
            errors["externalSpecialistDetails"] = "توضيح الاستعانة بالأخصائي الخارجي إلزامي عند «نعم»";

 // تاريخ التقييم: الأثر الرجعي = تاريخ يدوي + مبرر إلزامي (+ سجل تدقيق).
        if (ValuationDateModes.Normalize(valuationDateMode) == ValuationDateModes.Retrospective)
        {
            if (retrospectiveDate is null)
                errors["retrospectiveDate"] = "تاريخ التقييم بالأثر الرجعي إلزامي";
            if (string.IsNullOrWhiteSpace(retrospectiveRationale))
                errors["retrospectiveRationale"] = "مبرر الأثر الرجعي إلزامي";
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

 // ─── الافتراضات الخاصة (مكتبة الانتقاء تُدار في إعدادات تبويب تقرير التقييم) ───

    private static readonly System.Text.Json.JsonSerializerOptions AssumptionsJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

 /// <summary>
 /// بند نفي الأخصائي في مكتبة الافتراضات — يُسقط عند اختيار «استُعين بأخصائي خارجي».
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

 /// <summary>النصوص تُجمَّد مع التقييم (لا معرفات) — تعديل المكتبة لاحقاً لا يغيّر المنتقى.</summary>
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

 /// <summary>ق-2: صفوف الترجيح تُبنى من الأساليب المفعَّلة فقط (الدخل مؤجَّل فلا يدخل).</summary>
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
