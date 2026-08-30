namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Atomic counter for reference numbering: (Dept + Type + Date YYMMDD) → Seq.
/// </summary>
public class DocumentReferenceCounter
{
    public Guid Id { get; set; }
    public string Dept { get; set; } = "";
    public string Type { get; set; } = "";
 /// <summary>YYMMDD Gregorian.</summary>
    public string DateKey { get; set; } = "";
    public int Seq { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
