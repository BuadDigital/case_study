namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// Legacy table for the retired internal-delegation-letters API.
/// Live letters print from ops-task <c>LetterRowsJson</c> / <c>Reference</c>.
/// Kept so system reset can still clear residual rows.
/// </summary>
public class InternalDelegationLetterSet
{
    public Guid Id { get; set; }
 /// <summary>مفتاح النطاق — عادةً assigneeId للمراجع الحكومي.</summary>
    public string ScopeKey { get; set; } = "";
    public string LettersJson { get; set; } = "[]";
    public DateTime UpdatedAtUtc { get; set; }
}
