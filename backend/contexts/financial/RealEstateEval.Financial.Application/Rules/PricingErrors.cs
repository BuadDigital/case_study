namespace RealEstateEval.Application.Rules;

/// <summary>
/// The single wording every category uses when the pricing table cannot answer. Sharing one string
/// keeps the message identical whether the gap is a visit, an inspection, a survey tier, or a key
/// receipt — the caller should never paper over it with a number of its own.
/// </summary>
public static class PricingErrors
{
    public const string FeeUnresolved =
        "تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.";

 /// <summary>
 /// Engineering-survey fees are tiered by area. An empty/unparseable property area cannot
 /// pick a tier even when the office pricing table is fully configured.
 /// </summary>
    public const string PropertyAreaMissing =
        "تعذر تحديد الأتعاب — مساحة العقار غير محددة أو غير صالحة. أدخل المساحة (م²) على العقار ثم أعد المحاولة.";
}
