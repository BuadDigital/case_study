namespace RealEstateEval.Domain;

/// <summary>Singleton attachment print dictionary (types + property-type links + required).</summary>
public class AttachmentPrintDictionaryConfig
{
    public Guid Id { get; set; }
    public string CatalogJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
