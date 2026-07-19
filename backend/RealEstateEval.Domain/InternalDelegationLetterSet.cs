namespace RealEstateEval.Domain;

/// <summary>
/// مجموعة خطابات تفويض داخلي ضمن نطاق مراجع/مندوب (ScopeKey)،
/// وليست مربوطة بأمر عمل واحد. المحتوى JSON لمصفوفة الخطابات.
/// </summary>
public class InternalDelegationLetterSet
{
    public Guid Id { get; set; }
    /// <summary>مفتاح النطاق — عادةً assigneeId للمراجع الحكومي.</summary>
    public string ScopeKey { get; set; } = "";
    public string LettersJson { get; set; } = "[]";
    public DateTime UpdatedAtUtc { get; set; }
}
