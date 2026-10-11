namespace RealEstateEval.Domain;

/// <summary>
/// Optional text normalization — The function was replicated with eight names across five contexts
/// (NullIfBlank / NullIfEmpty / NormalizeOptionalText / Normalize / Clean).
/// </summary>
public static class Texts
{
    public static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

 /// <summary>Numbers only — to normalize mobile numbers and IDs before comparing.</summary>
    public static string DigitsOnly(string value) =>
        new(ToAsciiDigits(value).Where(char.IsAsciiDigit).ToArray());

 /// <summary>Arabic (٠-٩) and Persian (۰-۹) digits → Latin 0-9; every other character is kept.</summary>
    public static string ToAsciiDigits(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        var chars = value.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            var ch = chars[i];
            if (ch is >= '٠' and <= '٩') chars[i] = (char)('0' + (ch - '٠'));
            else if (ch is >= '۰' and <= '۹') chars[i] = (char)('0' + (ch - '۰'));
        }
        return new string(chars);
    }

 /// <summary>Unified mail check — MailAddress in one context and regex in another had two different acceptances.</summary>
    public static bool IsValidEmail(string email) =>
        System.Text.RegularExpressions.Regex.IsMatch(
            email,
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
}
