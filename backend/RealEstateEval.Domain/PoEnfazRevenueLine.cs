namespace RealEstateEval.Domain;

/// <summary>
/// Enfaz (Infath) revenue entered by finance per property within a work order.
/// Split into case-study fee + survey/raising fee (agreed finance model).
/// </summary>
public class PoEnfazRevenueLine
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
    /// <summary>دخل على إجمالي دراسة المعاملة.</summary>
    public decimal CaseStudyFeeSar { get; set; }
    /// <summary>دخل لتكاليف الرفع.</summary>
    public decimal SurveyFeeSar { get; set; }
    public bool IncludedInBilling { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; }

    public decimal TotalFeeSar => CaseStudyFeeSar + SurveyFeeSar;
}
