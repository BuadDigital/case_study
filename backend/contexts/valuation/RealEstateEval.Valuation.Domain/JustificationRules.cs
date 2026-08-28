namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// ق-8-2 (سجل القرارات v2): حد أدنى لطول المبرر يمنع المبرر الصوري من حرف أو نقطة.
/// يسري على كل المبررات الإلزامية في حزمة التقييم (تسويات، أوزان، وسوم، تنبيهات بمبرر)
/// دون المساس بحقول «النص الحر» (قرار 19).
/// </summary>
public static class JustificationRules
{
 /// <summary>اقتراح الحزمة المعتمد في ق-8: ~10 أحرف.</summary>
    public const int MinLength = 10;

 /// <summary>مبرر مقبول: نص غير فارغ طوله بعد التشذيب ≥ الحد الأدنى.</summary>
    public static bool IsAcceptable(string? rationale) =>
        (rationale?.Trim().Length ?? 0) >= MinLength;

 /// <summary>فارغ تماماً (لا يُعد إدخالاً) — يختلف عن «قصير جداً».</summary>
    public static bool IsBlank(string? rationale) =>
        string.IsNullOrWhiteSpace(rationale);

 /// <summary>غير فارغ لكنه أقصر من الحد — الحالة التي يمنعها ق-8-2 تحديداً.</summary>
    public static bool IsTooShort(string? rationale) =>
        !IsBlank(rationale) && !IsAcceptable(rationale);

    public static string TooShortMessageAr(string labelAr) =>
        $"{labelAr}: المبرر أقصر من الحد الأدنى ({MinLength} أحرف) — اكتب مبرراً جوهرياً (ق-8).";
}

/// <summary>
/// ق-8-1: المبرر على مستوى العامل لا البند×المقارن — مبرر واحد للعامل يغطي كل المقارنات
/// ما دام المنطق واحداً، مع إمكان تخصيص مبرر لمقارن بعينه عند الاختلاف.
/// سطر التسوية يحمل «التخصيص» فقط؛ الفارغ يرث مبرر العامل.
/// </summary>
public class ValuationAdjustmentFactorRationale
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
 /// <summary>market | land_within_cost — جدولان مستقلان (نظير سياق الاختيار).</summary>
    public string SelectionContext { get; set; } = ComparableSelectionContexts.Market;
 /// <summary>See <see cref="MarketAdjustmentFactorKeys"/> — أو مفتاح عامل مخصص.</summary>
    public string FactorKey { get; set; } = "";
    public string RationaleAr { get; set; } = "";
    public DateTime UpdatedAtUtc { get; set; }
    public string? UpdatedByUserId { get; set; }
}
