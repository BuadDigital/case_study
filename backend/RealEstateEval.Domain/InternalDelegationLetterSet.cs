namespace RealEstateEval.Domain;

/// <summary>Per-PO internal delegation letter selections (JSON array).</summary>
public class InternalDelegationLetterSet
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public string LettersJson { get; set; } = "[]";
    public DateTime UpdatedAtUtc { get; set; }
}
