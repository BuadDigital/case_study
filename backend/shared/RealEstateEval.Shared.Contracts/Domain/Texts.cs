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
        new(value.Where(char.IsDigit).ToArray());

 /// <summary>Unified mail check — MailAddress in one context and regex in another had two different acceptances.</summary>
    public static bool IsValidEmail(string email) =>
        System.Text.RegularExpressions.Regex.IsMatch(
            email,
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
}
