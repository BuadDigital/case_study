namespace RealEstateEval.Domain;

/// <summary>
/// تطبيع الجوال السعودي — عقد واحد للتسجيل والدخول (ق٣: الجوال معرّف دخول
/// فريد إلزامي). كان التسجيل يقبل أي رقم دولي بينما الدخول سعودي فقط،
/// فيُخزَّن رقم لا يمكن الدخول به أبداً.
/// يقبل +9665… / 009665… / 05… / 5XXXXXXXX ويعيد +9665XXXXXXXX،
/// وnull لكل ما سواه.
/// </summary>
public static class SaudiMobiles
{
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = Texts.DigitsOnly(raw);
        if (digits.StartsWith("00966", StringComparison.Ordinal))
            digits = digits[2..];
        if (digits.StartsWith("966", StringComparison.Ordinal))
            digits = digits[3..];
        if (digits.StartsWith('0'))
            digits = digits[1..];
        if (digits.Length != 9 || digits[0] != '5')
            return null;
        return $"+966{digits}";
    }
}
