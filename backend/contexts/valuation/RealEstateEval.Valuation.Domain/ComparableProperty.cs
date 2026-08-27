namespace RealEstateEval.Domain;

/// <summary>
/// Company-wide comparable property bank (/ ).
/// Soft-deactivate only; no hard delete.
/// </summary>
public class ComparableProperty
{
    public Guid Id { get; set; }
    public string ReferenceCode { get; set; } = "";

 /// <summary>Comparable property type — ق-3/5: قائمة مغلقة تُغلق من الواجهة (نفس قائمة العقار محل التقييم).</summary>
    public string ComparablePropertyType { get; set; } = "";

 /// <summary>استخدام المقارن — ق-3/5: قائمة مغلقة = قائمة استخدام العقار محل التقييم.</summary>
    public string Usage { get; set; } = "";

 /// <summary>offer | executed</summary>
    public string TransactionKind { get; set; } = ComparableTransactionKinds.Offer;

 /// <summary>asking | negotiable | som — for offers only; empty for executed.</summary>
    public string PriceDescription { get; set; } = "";

 /// <summary>bourse | listing_platform | field | prior_valuation | other</summary>
    public string Source { get; set; } = ComparableSources.Other;

    public string? ListingNumber { get; set; }
 /// <summary>ق-3/3: مرجع صفقة البورصة العقارية للمنفّذ — نظير رقم الإعلان للعروض.</summary>
    public string? TransactionReference { get; set; }
    public string? AdvertiserPhone { get; set; }
 /// <summary>Stored only — never printed in report appendices.</summary>
    public string? ListingImageFileName { get; set; }

    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }

    public decimal AreaSqm { get; set; }
 /// <summary>Transaction date — mandatory.</summary>
    public DateOnly TransactionDate { get; set; }
    public decimal Price { get; set; }
 /// <summary>Computed Price ÷ AreaSqm (stored for query/filter).</summary>
    public decimal PricePerSqm { get; set; }

    public string? City { get; set; }
    public string District { get; set; } = "";
    public string? PlanNumber { get; set; }
    public string? PlotNumber { get; set; }
    public string? Description { get; set; }

 /// <summary>field | office | system — intake stream.</summary>
    public string IntakeChannel { get; set; } = ComparableIntakeChannels.Office;

    public string? EnteredByUserId { get; set; }
    public DateTime EnteredAtUtc { get; set; }

 /// <summary>Provenance when seeded from a prior deal (no cross-schema FK).</summary>
    public string? SourceWorkOrderNumber { get; set; }
    public Guid? SourcePropertyId { get; set; }

    public bool IsActive { get; set; } = true;

 // ق-3: منظومة الوسوم البشرية — السجل يبقى موسوماً لا يُحذف.
 /// <summary>normal | anomalous | unreliable — وسم الموثوقية يضعه المقيّم بمبرر.</summary>
    public string ReliabilityTag { get; set; } = ComparableReliabilityTags.Normal;
 /// <summary>وسم «مكرر» — بشري لا آلي؛ المرفوض تسجيل نفس العملية مرتين لا تعاقب البيوع.</summary>
    public bool IsDuplicateTagged { get; set; }
 /// <summary>إلزامي عند أي وسم مفعَّل.</summary>
    public string? TagRationale { get; set; }
 /// <summary>الوسم مؤرَّخ باسم واضعه (بطاقة مصدر).</summary>
    public string? TaggedByUserId { get; set; }
    public DateTime? TaggedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

 /// <summary>ق-3: الموسوم شاذاً/غير موثوق/مكرراً يُستبعد من الاقتراحات (ويُميَّز بصرياً في القوائم).</summary>
    public bool IsExcludedFromSuggestions =>
        IsDuplicateTagged
        || !string.Equals(ReliabilityTag, ComparableReliabilityTags.Normal, StringComparison.Ordinal);
}

/// <summary>ق-3/1 — وسم موثوقية المقارن: عادي · شاذ · غير موثوق.</summary>
public static class ComparableReliabilityTags
{
    public const string Normal = "normal";
    public const string Anomalous = "anomalous";
    public const string Unreliable = "unreliable";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Normal or Anomalous or Unreliable;

    public static string Normalize(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return IsKnown(v) ? v : Normal;
    }

    public static string LabelAr(string? value) => Normalize(value) switch
    {
        Anomalous => "شاذ",
        Unreliable => "غير موثوق",
        _ => "عادي",
    };
}

public static class ComparableTransactionKinds
{
    public const string Offer = "offer";
    public const string Executed = "executed";

    public static bool IsKnown(string? value) =>
        value is Offer or Executed;

    public static string LabelAr(string value) => value switch
    {
        Offer => "عرض قائم",
        Executed => "صفقة منفذة",
        _ => value,
    };
}

public static class ComparablePriceDescriptions
{
 /// <summary>حد — سقف أعلى يحدّه البائع (ق-2).</summary>
    public const string Asking = "asking";
 /// <summary>ق-2: أُسقطت من قوائم الإدخال (كانت من العينة) — تبقى مقروءة للسجلات القديمة.</summary>
    public const string Negotiable = "negotiable";
 /// <summary>سوم — آخر سعر من راغب شراء (ق-2).</summary>
    public const string Som = "som";

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value) || value is Asking or Negotiable or Som;

    public static string LabelAr(string? value) => value switch
    {
        Asking => "حد",
        Negotiable => "تفاوض",
        Som => "سوم",
        _ => "",
    };
}

public static class ComparableSources
{
    public const string Bourse = "bourse";
    public const string ListingPlatform = "listing_platform";
    public const string Field = "field";
    public const string PriorValuation = "prior_valuation";
    public const string Other = "other";

    public static bool IsKnown(string? value) =>
        value is Bourse or ListingPlatform or Field or PriorValuation or Other;

    public static string LabelAr(string? value) => value switch
    {
        Bourse => "البورصة العقارية",
        ListingPlatform => "منصة عقارية",
        Field => "رصد ميداني",
        PriorValuation => "تقييم سابق",
        Other => "مصدر آخر",
        _ => value ?? "",
    };
}

public static class ComparableIntakeChannels
{
    public const string Field = "field";
    public const string Office = "office";
    public const string System = "system";

    public static bool IsKnown(string? value) =>
        value is Field or Office or System;

    public static string LabelAr(string value) => value switch
    {
        Field => "ميداني",
        Office => "مكتبي",
        System => "اقتراح النظام",
        _ => value,
    };
}
