namespace RealEstateEval.Financial.Domain;

/// <summary>
/// Enfaz (Infath) revenue entered by finance per property within a work order.
/// Split into case-study fee + survey/raising fee (agreed finance model).
/// </summary>
public class PoEnfazRevenueLine
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
 /// <summary>Income on the total study of the transaction.</summary>
    public decimal CaseStudyFeeSar { get; set; }
 /// <summary>Income for upload costs.</summary>
    public decimal SurveyFeeSar { get; set; }
 /// <summary>Key receipt fee — entered manually by Finance when an envelope accrual exists.</summary>
    public decimal KeyFeeSar { get; set; }
 /// <summary>Optional link to a key envelope entitlement row on this property/PO.</summary>
    public Guid? KeyEntitlementEnvelopeId { get; set; }
    public bool IncludedInBilling { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; }

    public decimal TotalFeeSar => CaseStudyFeeSar + SurveyFeeSar + KeyFeeSar;
}
