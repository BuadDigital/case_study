namespace RealEstateEval.Domain;

/// <summary>
/// Company-wide comparable property bank (§1.5 / decision 11e).
/// Soft-deactivate only; no hard delete.
/// </summary>
public class ComparableProperty
{
    public Guid Id { get; set; }
    public string ReferenceCode { get; set; } = "";

    /// <summary>Comparable property type — e.g. residential land.</summary>
    public string ComparablePropertyType { get; set; } = "";

    /// <summary>offer | executed</summary>
    public string TransactionKind { get; set; } = ComparableTransactionKinds.Offer;

    /// <summary>asking | negotiable — for offers only; empty for executed.</summary>
    public string PriceDescription { get; set; } = "";

    /// <summary>bourse | listing_platform | field | prior_valuation | other</summary>
    public string Source { get; set; } = ComparableSources.Other;

    public string? ListingNumber { get; set; }
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
    public string? Description { get; set; }

    /// <summary>field | office | system — intake stream.</summary>
    public string IntakeChannel { get; set; } = ComparableIntakeChannels.Office;

    public string? EnteredByUserId { get; set; }
    public DateTime EnteredAtUtc { get; set; }

    /// <summary>Provenance when seeded from a prior deal (no cross-schema FK).</summary>
    public string? SourceWorkOrderNumber { get; set; }
    public Guid? SourcePropertyId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public static class ComparableTransactionKinds
{
    public const string Offer = "offer";
    public const string Executed = "executed";

    public static bool IsKnown(string? value) =>
        value is Offer or Executed;

    public static string LabelAr(string value) => value switch
    {
        Offer => "عرض",
        Executed => "تنفيذ",
        _ => value,
    };
}

public static class ComparablePriceDescriptions
{
    public const string Asking = "asking";
    public const string Negotiable = "negotiable";

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value) || value is Asking or Negotiable;

    public static string LabelAr(string? value) => value switch
    {
        Asking => "حد",
        Negotiable => "تفاوض",
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
