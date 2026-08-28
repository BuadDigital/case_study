namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// سجل المستندات المرقّمة (قرار 25 + ورشة الترقيم): الكيانان 5–6 — الخطابات
/// (LT) وتقارير دراسة الحالة (CS). الصف يُنشأ لحظة تخصيص الرقم عند الطباعة/
/// الإصدار ولا يُعدَّل بعدها — سجل مرجعي لا مخزن مستندات.
/// </summary>
public class NumberedDocument
{
    public Guid Id { get; set; }
 /// <summary>letter | case-study-report.</summary>
    public string Kind { get; set; } = "";
    public string ReferenceNumber { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
 /// <summary>عنوان وصفي — مثل «خطاب تفويض داخلي — زيارة محكمة».</summary>
    public string Title { get; set; } = "";
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public static class NumberedDocumentKinds
{
    public const string Letter = "letter";
    public const string CaseStudyReport = "case-study-report";

    public static bool IsValid(string kind) =>
        kind is Letter or CaseStudyReport;
}
