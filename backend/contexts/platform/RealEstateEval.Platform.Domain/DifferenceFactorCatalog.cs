using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Platform.Domain;

/// <summary>
/// Difference-factor definitions and their «ما لا يشمله» limits are
/// admin-managed reference data with a version log — not code constants.
/// </summary>
public class DifferenceFactorCatalogConfig
{
    public Guid Id { get; set; }
    public string CatalogJson { get; set; } = "{}";
 /// <summary>Monotonic version — bumped on every admin save (سجل نسخ + audit rows).</summary>
    public int Version { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>One factor's reference definition — shown on hover and stored with the factor.</summary>
public sealed record DifferenceFactorDefinition(
    string Key,
    string LabelAr,
    string DefinitionAr,
    string ExcludesAr,
    int SortOrder,
    bool IsActive);

public static class DifferenceFactorCatalog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static IReadOnlyList<DifferenceFactorDefinition> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Trim() == "{}") return [];
        try
        {
            return JsonSerializer.Deserialize<List<DifferenceFactorDefinition>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string Serialize(IReadOnlyList<DifferenceFactorDefinition> entries) =>
        JsonSerializer.Serialize(entries, JsonOptions);

    public static string? Validate(IReadOnlyList<DifferenceFactorDefinition> entries)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entries)
        {
            if (string.IsNullOrWhiteSpace(e.Key))
                return "مفتاح العامل مطلوب";
            if (!seen.Add(e.Key.Trim()))
                return $"مفتاح مكرر: {e.Key}";
            if (string.IsNullOrWhiteSpace(e.LabelAr))
                return "تسمية العامل مطلوبة";
            if (string.IsNullOrWhiteSpace(e.DefinitionAr))
                return "تعريف العامل مطلوب";
        }

        return null;
    }

 /// <summary>Seed — the 12 approved definitions with their anti-double-counting limits.</summary>
    public static IReadOnlyList<DifferenceFactorDefinition> Seed() =>
    [
        new(MarketAdjustmentFactorKeys.IdealArea, "المساحة المثالية",
            "قرب مساحة القطعة من المساحة السائدة للاستخدام في الحي",
            "الفرق العددي في المساحة", 1, true),
        new(MarketAdjustmentFactorKeys.Location, "الموقع",
            "أفضلية الحي أو المنطقة — المكانة والخدمات ومستوى التطوير",
            "القرب من معلم محدد · موضع القطعة داخل الحي", 2, true),
        new(MarketAdjustmentFactorKeys.Attraction, "عامل الجذب للموقع",
            "القرب من معلم يرفع الطلب (حرم · واجهة بحرية · مركز تجاري كبير)",
            "أفضلية الحي عمومًا · سهولة الوصول", 3, true),
        new(MarketAdjustmentFactorKeys.Access, "سهولة الوصول",
            "موضع القطعة داخل نسيج الحي وقربها من المداخل والطرق الرئيسة",
            "عرض الشوارع ولا عددها", 4, true),
        new(MarketAdjustmentFactorKeys.StreetCount, "عدد الشوارع",
            "عدد الواجهات المطلة — واجهة · زاوية · أكثر",
            "عرض هذه الشوارع", 5, true),
        new(MarketAdjustmentFactorKeys.StreetLengths, "أطوال الشوارع",
            "عرض الشوارع المطلة وأطوال الواجهات عليها",
            "عددها · موضع القطعة في الحي", 6, true),
        new(MarketAdjustmentFactorKeys.PlotShape, "شكل القطعة",
            "انتظام الأضلاع ونسبة العمق إلى الواجهة",
            "الفرق العددي في المساحة", 7, true),
        new(MarketAdjustmentFactorKeys.Topography, "طبوغرافيا الأرض",
            "المنسوب والميل وكلفة التسوية أو الردم",
            "", 8, true),
        new(MarketAdjustmentFactorKeys.Zoning, "تنظيم البناء",
            "نسبة البناء وعدد الأدوار والارتدادات",
            "", 9, true),
        new(MarketAdjustmentFactorKeys.Services, "الخدمات والبنية التحتية",
            "اكتمال السفلتة والإنارة والخدمات",
            "", 10, true),
        new(MarketAdjustmentFactorKeys.Restrictions, "القيود والارتفاقات",
            "القيود النظامية وحقوق الارتفاق",
            "", 11, true),
        new(MarketAdjustmentFactorKeys.Development, "حالة التطوير",
            "خام · مخططة · مطوّرة بالكامل",
            "", 12, true),
    ];
}
