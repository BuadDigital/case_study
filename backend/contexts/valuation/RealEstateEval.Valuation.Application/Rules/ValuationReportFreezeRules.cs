namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// ق-6 freeze wording, stated once. The predicate itself is a persistence question and lives
/// behind <c>IValuationReportFreezeGate</c>.
/// </summary>
public static class ValuationReportFreezeRules
{
    public const string FrozenMessageAr =
        "التقرير مجمّد — صدرت نسخة الإيداع (ق-6)؛ الرمز والشهادة وحدهما قابلان للتسجيل";
}
