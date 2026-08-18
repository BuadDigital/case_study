namespace RealEstateEval.Domain;

/// <summary>Singleton admin config: question × party role matrix for case study forms.</summary>
public class CaseStudyInfoRolesConfig
{
    public Guid Id { get; set; }
    public string MatrixJson { get; set; } = "{}";
    public string NotesJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; }
}
