namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Company-wide comparable property bank (/ ).
/// Soft-deactivate only; no hard delete.
/// </summary>
public class ComparableProperty
{
    public Guid Id { get; set; }
    public string ReferenceCode { get; set; } = "";

 /// <summary>Comparable property type — Q-3/5: closed list enforced by the UI (same as subject property types).</summary>
    public string ComparablePropertyType { get; set; } = "";

 /// <summary>Comparable use — Q-3/5: closed list = subject property use list.</summary>
    public string Usage { get; set; } = "";

 /// <summary>offer | executed</summary>
    public string TransactionKind { get; set; } = ComparableTransactionKinds.Offer;

 /// <summary>asking | negotiable | som — for offers only; empty for executed.</summary>
    public string PriceDescription { get; set; } = "";

 /// <summary>bourse | listing_platform | field | prior_valuation | other</summary>
    public string Source { get; set; } = ComparableSources.Other;

    public string? ListingNumber { get; set; }
 /// <summary>Q-3/3: real-estate bourse deal reference for closed deals — counterpart to listing number for offers.</summary>
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

 // Q-3: human tagging system — the record stays tagged; it is not deleted.
 /// <summary>normal | anomalous | unreliable — reliability tag set by the valuer with a rationale.</summary>
    public string ReliabilityTag { get; set; } = ComparableReliabilityTags.Normal;
 /// <summary>"Duplicate" tag — human, not automatic; rejects recording the same deal twice, not successive sales.</summary>
    public bool IsDuplicateTagged { get; set; }
 /// <summary>Required when any tag is enabled.</summary>
    public string? TagRationale { get; set; }
 /// <summary>Tag is dated with the author name (source card).</summary>
    public string? TaggedByUserId { get; set; }
    public DateTime? TaggedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

 /// <summary>Q-3: anomalous/unreliable/duplicate tagged items are excluded from suggestions (and visually marked in lists).</summary>
    public bool IsExcludedFromSuggestions =>
        IsDuplicateTagged
        || !string.Equals(ReliabilityTag, ComparableReliabilityTags.Normal, StringComparison.Ordinal);

 /// <summary>
 /// B2/Q-3: tagging rules on the aggregate — any enabled tag requires a substantive rationale (Q-8-2),
 /// and the tag is dated with the author; clearing all tags clears the trail.
 /// Returns (field name, message) on rejection.
 /// </summary>
    public (string Field, string MessageAr)? ApplyQualityTags(
        string? reliabilityTag,
        bool isDuplicateTagged,
        string? tagRationale,
        string? taggedByUserId,
        DateTime nowUtc)
    {
        if (!ComparableReliabilityTags.IsKnown(reliabilityTag))
            return ("reliabilityTag", "وسم الموثوقية غير معروف (عادي/شاذ/غير موثوق)");

        var tag = ComparableReliabilityTags.Normalize(reliabilityTag);
        var anyTag = isDuplicateTagged
            || !string.Equals(tag, ComparableReliabilityTags.Normal, StringComparison.Ordinal);
        if (anyTag && string.IsNullOrWhiteSpace(tagRationale))
            return ("tagRationale", "مبرر الوسم إلزامي عند وسم شاذ/غير موثوق/مكرر");
        if (anyTag && JustificationRules.IsTooShort(tagRationale))
            return ("tagRationale", JustificationRules.TooShortMessageAr("مبرر الوسم"));

        ReliabilityTag = tag;
        IsDuplicateTagged = isDuplicateTagged;
        TagRationale = anyTag ? tagRationale!.Trim() : null;
        TaggedByUserId = anyTag
            ? (string.IsNullOrWhiteSpace(taggedByUserId) ? "unknown" : taggedByUserId.Trim())
            : null;
        TaggedAtUtc = anyTag ? nowUtc : null;
        UpdatedAtUtc = nowUtc;
        return null;
    }
}

/// <summary>Q-3/1 — comparable reliability tag: normal · anomalous · unreliable.</summary>
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
 /// <summary>Ceiling — upper bound set by the seller (Q-2).</summary>
    public const string Asking = "asking";
 /// <summary>Q-2: dropped from input lists (was sample data) — still readable for legacy records.</summary>
    public const string Negotiable = "negotiable";
 /// <summary>Som — last price from a willing buyer (Q-2).</summary>
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
