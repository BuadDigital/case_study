namespace RealEstateEval.Domain;

/// <summary>
/// One engineering-survey area band. <see cref="MaxAreaM2"/> null = open-ended (above previous max).
/// </summary>
public class PartyFeePricingTier
{
    public Guid Id { get; set; }

    public Guid TableId { get; set; }

    public PartyFeePricingTable Table { get; set; } = null!;

    public int SortOrder { get; set; }

    /// <summary>Inclusive upper bound (م²). Null for the last (open-ended) tier.</summary>
    public decimal? MaxAreaM2 { get; set; }

    public decimal FeeSar { get; set; }
}
