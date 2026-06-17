namespace RealEstateEval.Domain;

/// <summary>Singleton field dictionary state (fields, tags, screens).</summary>
public class FieldDictionaryConfig
{
    public Guid Id { get; set; }
    public string StateJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
