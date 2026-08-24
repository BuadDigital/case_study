namespace RealEstateEval.Domain;

/// <summary>
/// Links a bank comparable to a subject property. The bank row stays reusable;
/// this row is the per-property attachment the specialist manages.
/// </summary>
public class PropertyComparableLink
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public Guid ComparablePropertyId { get; set; }

    /// <summary>Specialist write-up for this property — does not overwrite the bank row.</summary>
    public string? Description { get; set; }

    public string? LinkedByUserId { get; set; }
    public DateTime LinkedAtUtc { get; set; }

    public ComparableProperty? ComparableProperty { get; set; }
}
