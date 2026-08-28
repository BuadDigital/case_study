namespace RealEstateEval.Domain;

/// <summary>
/// ورشة الترقيم (قرار 22 + بنود البتّ 1–5): النمط الموحد {بادئة}-{سنة}-{تسلسل ٥}
/// بتسلسل سنوي وأرقام لاتينية. هذه الدالة هي «الـseam» الوحيد للصيغة — أي تعديل
/// لاحق من الورشة يغيّر هنا فقط. الأرقام الصادرة قبل التفعيل لا تتغير أبداً.
/// </summary>
public static class ReferenceNumbering
{
 // بوادئ الكيانات الثمانية (بند البتّ 2) + المرجع الخارجي لتقرير التقييم (بند 3).
    public const string Property = "PR";
    public const string Transaction = "TX";
    public const string User = "US";
    public const string Vendor = "VN";
    public const string Letter = "LT";
    public const string CaseStudyReport = "CS";
    public const string DisbursementStatement = "DS";
    public const string KeyEnvelope = "KE";
    public const string ValuationReport = "TQ";

    public const int MaxYearlySequence = 99_999;

 /// <summary>السنة الميلادية بتوقيت الرياض — حدود السنة تتبع تقويم العمل المحلي.</summary>
    public static int RiyadhYear(DateTime utcNow) => utcNow.AddHours(3).Year;

    public static string Format(string prefix, int year, int sequence) =>
        $"{prefix}-{year:D4}-{sequence:D5}";
}
