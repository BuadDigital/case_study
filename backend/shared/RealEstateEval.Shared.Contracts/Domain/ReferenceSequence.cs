namespace RealEstateEval.Domain;

/// <summary>
/// عدّاد الأرقام المرجعية السنوية (ورشة الترقيم — بند البتّ 1): صف لكل
/// (بادئة × سنة) في مخطط السياق المالك، والتخصيص بحفظ upsert ذري.
/// كيان مشترك يُعيَّن في أكثر من سياق — على نمط <see cref="AuditLog"/>.
/// </summary>
public class ReferenceSequence
{
    public Guid Id { get; set; }
    public string Prefix { get; set; } = "";
    public int Year { get; set; }
    public int LastValue { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
