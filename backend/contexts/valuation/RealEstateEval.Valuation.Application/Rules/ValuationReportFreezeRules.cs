namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// ق-6 freeze wording, stated once. The predicate itself is a persistence question and lives
/// behind <c>IValuationReportFreezeGate</c>.
/// </summary>
public static class ValuationReportFreezeRules
{
    public const string FrozenMessageAr =
        "التقرير مجمّد — صدرت نسخة الإيداع؛ الرمز والشهادة وحدهما قابلان للتسجيل";

    /// <summary>The appraisal package was handed to the case specialist; numbers are closed until it is returned.</summary>
    public const string AppraiserSubmittedMessageAr =
        "سُلِّم التقييم إلى أخصائي دراسة الحالة — بياناته مقفلة حتى يُعيده الأخصائي للتصحيح";

    /// <summary>Error-code prefix for a write refused by the freeze gate; the rest is the Arabic reason.</summary>
    public const string LockedErrorPrefix = "report_locked:";

    /// <summary>Fail-closed wording when the hand-over state cannot be read from Case Study.</summary>
    public const string PackageStateUnavailableMessageAr =
        "تعذّر التحقق من حالة تسليم التقييم — أعد المحاولة بعد قليل";
}
