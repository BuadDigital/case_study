namespace RealEstateEval.Domain;

/// <summary>Per-user PO intake wizard draft (JSON payload).</summary>
public class PoIntakeDraft
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string DraftJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
