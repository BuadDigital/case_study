namespace RealEstateEval.Domain;

/// <summary>
/// عدّاد ذرّي للترقيم المرجعي: (Dept + Type + Date YYMMDD) → Seq.
/// </summary>
public class DocumentReferenceCounter
{
    public Guid Id { get; set; }
    public string Dept { get; set; } = "";
    public string Type { get; set; } = "";
    /// <summary>YYMMDD ميلادي.</summary>
    public string DateKey { get; set; } = "";
    public int Seq { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
