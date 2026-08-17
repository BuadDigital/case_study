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

 /// <summary>وحدة قياس التكلفة — see <see cref="CostMeasurementUnitKeys"/>.</summary>
    public string CostMeasurementUnitKey { get; set; } = CostMeasurementUnitKeys.ComparisonUnit;

 /// <summary>صلاحية تحرير التسويات — معطّلة تمنع حفظ بنود التسوية والأوزان.</summary>
    public bool AdjustmentsEditUnlocked { get; set; } = true;

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
        bool hasStructuresToValue = false)
    {
        var errors = new Dictionary<string, string>();

        if (!marketEnabled && !costEnabled && !incomeEnabled)
            errors["appliedApproaches"] = "يلزم تفعيل أسلوب واحد على الأقل";

        if (incomeEnabled)
            errors["incomeApproachEnabled"] = "أسلوب الدخل قيد الإنشاء — مؤجَّل رسمياً";

        if (costEnabled && !CanEnableCostApproach(propertyType, hasStructuresToValue))
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
