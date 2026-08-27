namespace RealEstateEval.Domain;

public static class MarketAdjustmentFactorKeys
{
 // sequential
    public const string Financing = "financing";
    public const string Market = "market";
    public const string TransactionType = "transaction_type";
 // area (treated with difference factors: sum-then-apply)
    public const string Area = "area";
 // difference factors
    public const string IdealArea = "ideal_area";
    public const string Location = "location";
    public const string Attraction = "attraction";
    public const string Access = "access";
    public const string StreetCount = "street_count";
    public const string StreetLengths = "street_lengths";
    public const string PlotShape = "plot_shape";
    public const string Topography = "topography";
    public const string Zoning = "zoning";
    public const string Services = "services";
    public const string Restrictions = "restrictions";
    public const string Development = "development";
    public const string Custom = "custom";

    public static readonly string[] StandardSequential =
        [Financing, Market, TransactionType];

    /// <summary>مواصفة النموذج التفاعلي: المساحة الآلية + أربعة عوامل اختلاف افتراضية (الموقع، الجذب، الوصول، عدد الشوارع).</summary>
    public static readonly string[] DefaultDifferenceFactors =
    [
        Area,
        Location,
        Attraction,
        Access,
        StreetCount,
    ];

    /// <summary>كتالوج إضافي — يُضاف من الواجهة عند الحاجة (يشمل المساحة المثالية وأطوال الشوارع).</summary>
    public static readonly string[] CatalogExtraDifferenceFactors =
    [
        IdealArea,
        StreetLengths,
        PlotShape,
        Topography,
        Zoning,
        Services,
        Restrictions,
        Development,
    ];

    /// <summary>كل عوامل الاختلاف المعروفة (افتراضي + كتالوج + مخصص عبر المفتاح).</summary>
    public static readonly string[] StandardDifferenceFactors =
        [.. DefaultDifferenceFactors, .. CatalogExtraDifferenceFactors];

    public static string DefaultLabelAr(string key) => key switch
    {
        Financing => "تسوية شروط التمويل",
        Market => "تسوية ظروف السوق",
        TransactionType => "تسوية نوع المقارن",
        Area => "تسوية المساحة",
        IdealArea => "المساحة المثالية",
        Location => "الموقع",
        Attraction => "عامل الجذب للموقع",
        Access => "سهولة الوصول",
        StreetCount => "عدد الشوارع",
        StreetLengths => "أطوال الشوارع",
        PlotShape => "شكل القطعة",
        Topography => "طبوغرافيا الأرض",
        Zoning => "تنظيم البناء",
        Services => "الخدمات والبنية التحتية",
        Restrictions => "القيود والارتفاقات",
        Development => "حالة التطوير",
        _ => "عامل مضاف",
    };

    public static bool IsSequential(string? key) =>
        key is Financing or Market or TransactionType;

    public static bool IsDifferenceFactor(string? key) =>
        key is Area or IdealArea or Location or Attraction or Access
            or StreetCount or StreetLengths or PlotShape or Topography
            or Zoning or Services or Restrictions or Development or Custom;

    public static bool IsKnown(string? key) =>
        IsSequential(key) || IsDifferenceFactor(key);
}
