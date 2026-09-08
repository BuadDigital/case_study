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

    /// <summary>Interactive model specification: automated space + four virtual differentiators (location, attraction, access, number of streets).</summary>
    public static readonly string[] DefaultDifferenceFactors =
    [
        Area,
        Location,
        Attraction,
        Access,
        StreetCount,
    ];

    /// <summary>Additional catalog — added from the interface when needed (includes ideal area and street lengths).</summary>
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

    /// <summary>
    /// Optional sequential rows stay out of the chain until the valuer ticks them.
    /// Market conditions and difference factors stay on.
    /// </summary>
    public static bool IncludedByDefault(string? key) =>
        key is not Financing and not TransactionType;

    /// <summary>
    /// Built-in difference keys keep a fixed Arabic label. Catalog extras and
    /// <see cref="Custom"/> keep the label sent by the client.
    /// </summary>
    public static bool HasFixedStandardLabel(string? key) =>
        key is Area or IdealArea or Location or Attraction or Access
            or StreetCount or StreetLengths or PlotShape or Topography
            or Zoning or Services or Restrictions or Development
            || IsSequential(key);

    public static bool IsDifferenceFactor(string? key) =>
        key is Area or IdealArea or Location or Attraction or Access
            or StreetCount or StreetLengths or PlotShape or Topography
            or Zoning or Services or Restrictions or Development or Custom
        || IsExtraCatalogKey(key);

    /// <summary>
    /// Admin catalog keys that are not in the built-in set (e.g. a finishing
    /// factor). Letter/digit/underscore/hyphen, max 32 — same as the column.
    /// </summary>
    public static bool IsExtraCatalogKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 32) return false;
        if (IsSequential(key) || HasFixedStandardLabel(key) || key == Custom) return false;
        foreach (var c in key)
        {
            if (!(char.IsLetterOrDigit(c) || c is '_' or '-')) return false;
        }

        return true;
    }

    public static bool IsKnown(string? key) =>
        IsSequential(key) || IsDifferenceFactor(key);
}
