namespace RealEstateEval.Platform.Domain;

/// <summary>
/// قرار 23 (المعدَّل بق-15: «نسخة واحدة للحزمة»): النصوص المعيارية/القانونية كتلة واحدة
/// في الإدارة والإصدار برقم نسخة واحد للحزمة كلها — أي تعديل ولو في فقرة يصدر حزمة
/// نصوص جديدة كاملة. الصفوف غير قابلة للتعديل (سجل نسخ)؛ التمييز داخل التقرير يبقى
/// بالموضع والعنوان، ورقم النسخة يوسم الحزمة لا الفقرة.
/// التقرير قيد العمل يتبنى الأحدث تلقائياً؛ والمُصدَر مجمّد على نصوصه لحظة الإصدار
/// (لقطة ق-6) — لا تغيير بأثر رجعي. لا نسخ إنجليزية حالياً (قرار 23-3).
/// </summary>
public class ValuationReportTextPackage
{
    public Guid Id { get; set; }

 /// <summary>رقم الحزمة التسلسلي — «النصوص المعيارية: الحزمة نسخة N».</summary>
    public int Version { get; set; }

 /// <summary>الكتلة المُدارة (الحقول الستة من إعدادات المنشأة) كـ JSON قانوني الشكل.</summary>
    public string TextsJson { get; set; } = "{}";

    public DateTime CreatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
}

/// <summary>القيمة الأولى للحزمة — النصوص الافتراضية المشحونة تُعد «نسخة 1» ضمنياً.</summary>
public static class ReportTextPackageRules
{
    public const int InitialVersion = 1;
}
