using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

public class ComparableSourceCardDto
{
    public required string IntakeChannel { get; init; }
    public required string IntakeChannelLabelAr { get; init; }
 /// <summary>recent | stored — heuristic, not a hard expiry.</summary>
    public required string Freshness { get; init; }
    public required string FreshnessLabelAr { get; init; }
    public bool FromPriorDeal { get; init; }
    public string? SourceWorkOrderNumber { get; init; }
}

public class ComparablePropertyDto
{
    public Guid Id { get; init; }
    public required string ReferenceCode { get; init; }
    public required string ComparablePropertyType { get; init; }
 /// <summary>استخدام المقارن — قائمة مغلقة (ق-3/5).</summary>
    public string Usage { get; init; } = "";
    public required string TransactionKind { get; init; }
    public string TransactionKindLabelAr { get; init; } = "";
    public string PriceDescription { get; init; } = "";
    public string PriceDescriptionLabelAr { get; init; } = "";
    public required string Source { get; init; }
    public string? ListingNumber { get; init; }
 /// <summary>ق-3/3: مرجع صفقة البورصة للمنفّذ.</summary>
    public string? TransactionReference { get; init; }
    public string? AdvertiserPhone { get; init; }
    public string? ListingImageFileName { get; init; }
    public decimal Latitude { get; init; }
    public decimal Longitude { get; init; }
    public decimal AreaSqm { get; init; }
 /// <summary>yyyy-MM-dd</summary>
    public required string TransactionDate { get; init; }
    public decimal Price { get; init; }
    public decimal PricePerSqm { get; init; }
 /// <summary>anomaly notice — advisory, set on create/update/get.</summary>
    public string? PricePerSqmAnomalyNoteAr { get; init; }
    public string? City { get; init; }
    public required string District { get; init; }
    public string? PlanNumber { get; init; }
    public string? PlotNumber { get; init; }
    public string? Description { get; init; }
    public required string IntakeChannel { get; init; }
    public string? EnteredByUserId { get; init; }
    public string EnteredAtUtc { get; init; } = "";
    public string? SourceWorkOrderNumber { get; init; }
    public Guid? SourcePropertyId { get; init; }
    public bool IsActive { get; init; }

 // ق-3: وسوم الجودة البشرية.
 /// <summary>normal | anomalous | unreliable.</summary>
    public string ReliabilityTag { get; init; } = "normal";
    public string ReliabilityTagLabelAr { get; init; } = "";
    public bool IsDuplicateTagged { get; init; }
    public string? TagRationale { get; init; }
    public string? TaggedByUserId { get; init; }
    public string? TaggedAtUtc { get; init; }
 /// <summary>موسوم فيُستبعد من الاقتراحات ويُميَّز بصرياً.</summary>
    public bool IsExcludedFromSuggestions { get; init; }
 /// <summary>اشتباه تكرار آلي (سجل آخر بنفس الموقع) — اقتراح فقط، الوسم بشري.</summary>
    public bool DuplicateSuspect { get; init; }

    public string CreatedAtUtc { get; init; } = "";
    public string UpdatedAtUtc { get; init; } = "";
    public ComparableSourceCardDto SourceCard { get; init; } = null!;
}

/// <summary>ق-3: وضع/تحديث وسوم الجودة — يضعها أي ذي صفة بمبرر، والسجل يبقى.</summary>
public class SaveComparableQualityTagsRequest
{
 /// <summary>normal | anomalous | unreliable.</summary>
    [Required, MaxLength(16)]
    public string ReliabilityTag { get; init; } = "normal";

    public bool IsDuplicateTagged { get; init; }

 /// <summary>إلزامي عند أي وسم مفعَّل.</summary>
    [MaxLength(2000)]
    public string? TagRationale { get; init; }
}

public class UpsertComparablePropertyRequest
{
    [Required, MaxLength(128)]
    public string ComparablePropertyType { get; init; } = "";

 /// <summary>استخدام المقارن — قائمة مغلقة (ق-3/5).</summary>
    [MaxLength(64)]
    public string? Usage { get; init; }

 /// <summary>offer | executed</summary>
    [Required, MaxLength(16)]
    public string TransactionKind { get; init; } = "offer";

 /// <summary>asking | negotiable — required when offer</summary>
    [MaxLength(16)]
    public string? PriceDescription { get; init; }

    [Required, MaxLength(32)]
    public string Source { get; init; } = "other";

    [MaxLength(64)]
    public string? ListingNumber { get; init; }

 /// <summary>ق-3/3: مرجع صفقة البورصة — للمنفّذ، اختياري.</summary>
    [MaxLength(64)]
    public string? TransactionReference { get; init; }

    [MaxLength(32)]
    public string? AdvertiserPhone { get; init; }

    [MaxLength(512)]
    public string? ListingImageFileName { get; init; }

    public decimal Latitude { get; init; }
    public decimal Longitude { get; init; }

    public decimal AreaSqm { get; init; }

 /// <summary>yyyy-MM-dd — mandatory</summary>
    [Required, MaxLength(16)]
    public string TransactionDate { get; init; } = "";

    public decimal Price { get; init; }

    [MaxLength(128)]
    public string? City { get; init; }

    [Required, MaxLength(128)]
    public string District { get; init; } = "";

    [MaxLength(64)]
    public string? PlanNumber { get; init; }

    [MaxLength(64)]
    public string? PlotNumber { get; init; }

    [MaxLength(2000)]
    public string? Description { get; init; }

 /// <summary>field | office | system</summary>
    [Required, MaxLength(16)]
    public string IntakeChannel { get; init; } = "office";

    [MaxLength(64)]
    public string? SourceWorkOrderNumber { get; init; }

    public Guid? SourcePropertyId { get; init; }

    public bool IsActive { get; init; } = true;
}

public class ComparablePropertyListQuery
{
    public string? District { get; init; }
    public string? City { get; init; }
    public string? TransactionKind { get; init; }
    public string? Source { get; init; }
    public string? IntakeChannel { get; init; }
    public string? PropertyType { get; init; }
    public string? Q { get; init; }
    public string? FromDate { get; init; }
    public string? ToDate { get; init; }
    public bool IncludeInactive { get; init; }
    public int Take { get; init; } = 100;
    /// <summary>مواصفة-طريقة-المقارنة §٢: أولوية المقارنات الميدانية لهذا العقار ثم المخزّنة.</summary>
    public string? ForPropertyId { get; init; }
}

public class ComparableProximityQuery
{
 /// <summary>Subject property id — resolves coords from field-inspection workspace when set.</summary>
    public string? PropertyId { get; init; }

    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }

 /// <summary>Default 5 km.</summary>
    public decimal MaxDistanceKm { get; init; } = 5m;

    public int Take { get; init; } = 15;

 /// <summary>Comma-separated comparable ids already on the VR (excluded from suggestions).</summary>
    public string? ExcludeIds { get; init; }

    public string? District { get; init; }
    public string? PropertyType { get; init; }
}

public class ComparableProximitySuggestionDto
{
    public ComparablePropertyDto Comparable { get; init; } = null!;
    public decimal DistanceKm { get; init; }
}

public class ComparableProximitySuggestionListDto
{
    public decimal? SubjectLatitude { get; init; }
    public decimal? SubjectLongitude { get; init; }
 /// <summary>field_inspection | query | none</summary>
    public string SubjectCoordSource { get; init; } = "none";
    public decimal MaxDistanceKm { get; init; }
    public IReadOnlyList<ComparableProximitySuggestionDto> Items { get; init; } = [];
}
