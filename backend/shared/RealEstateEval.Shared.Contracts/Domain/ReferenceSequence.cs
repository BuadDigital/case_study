namespace RealEstateEval.Domain;

/// <summary>
/// Annual reference number counter (numbering shop — bit line 1): row for each
/// (prefix x year) in the owner context map, and the assignment is saved by atomic upsert.
/// A shared entity that is set in more than one context — <see cref="AuditLog"/> style.
/// </summary>
public class ReferenceSequence
{
    public Guid Id { get; set; }
    public string Prefix { get; set; } = "";
    public int Year { get; set; }
    public int LastValue { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
