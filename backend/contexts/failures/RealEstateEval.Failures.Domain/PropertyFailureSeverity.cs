namespace RealEstateEval.Failures.Domain;

/// <summary>
/// شدة التعثر — كانت نصوصاً حرة تتصادم مع ثوابت الحالة
/// («internal» حالة وشدة معاً). المصدر الوحيد للقيم المخزنة.
/// </summary>
public static class PropertyFailureSeverity
{
    public const string Suspected = "suspected";
    public const string Internal = "internal";
}
