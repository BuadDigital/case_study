namespace RealEstateEval.Domain;

/// <summary>
/// Saudi Mobile Normalization — One Contract Registration and Login (Q-3: Mobile Login ID
/// Unique is mandatory). Registration accepted any international number, while entry was Saudi only.
/// A number is stored that can never be accessed.
/// It accepts +9665… / 009665… / 05… / 5XXXXXXXX and returns +9665XXXXXXXX,
/// And null for everything else.
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
