namespace RealEstateEval.Domain;

/// <summary>Singleton failure types catalog (categories + problem types).</summary>
public class FailureTypesCatalogConfig
{
    public Guid Id { get; set; }
    public string CatalogJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
