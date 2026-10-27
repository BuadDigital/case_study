using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace RealEstateEval.Domain;

/// <summary>
/// Text a person typed (an area, an amount, a percent) → number, by the same rule the screens use
/// (packages/app-shared parseLocaleNumber; shared cases in tests/fixtures/locale-number-cases.json):
/// <list type="bullet">
/// <item>Arabic ٠-٩ and Persian ۰-۹ digits → Latin; ٫ (U+066B) is the decimal point; ٬ (U+066C) is dropped.</item>
/// <item>Units (م² م2 m² m2 % ر.س ريال) and all whitespace (NBSP and narrow NBSP included) are dropped.</item>
/// <item>ASCII comma: with a "." present, commas are thousands. Without one, well-formed 3-digit groups
/// ("1,250", "12,345,678") are thousands; otherwise a single comma is the decimal point ("12,5" → 12.5);
/// anything else is not a number.</item>
/// </list>
/// Blank text is not a number. Callers add their own range rules (e.g. an area must be &gt; 0).
/// </summary>
public static partial class LocaleNumber
{
    // Longest first so "م²" is not left half-stripped.
    private static readonly string[] UnitSuffixes = ["م²", "م2", "m²", "m2", "%", "ر.س", "ريال"];

    [GeneratedRegex(@"^-?\d{1,3}(,\d{3})+$", RegexOptions.CultureInvariant)]
    private static partial Regex ThousandsGrouped();

    [GeneratedRegex(@"^-?(\d+\.?\d*|\.\d+)$", RegexOptions.CultureInvariant)]
    private static partial Regex PlainNumber();

    public static bool TryParse(string? text, out decimal value)
    {
        value = 0m;
        if (text is null) return false;

        var s = Texts.ToAsciiDigits(text)
            .Replace('٫', '.')
            .Replace("٬", "", StringComparison.Ordinal);
        foreach (var unit in UnitSuffixes)
            s = s.Replace(unit, "", StringComparison.Ordinal);
        s = StripWhitespace(s);

        if (s.Contains(','))
        {
            if (s.Contains('.') || ThousandsGrouped().IsMatch(s))
                s = s.Replace(",", "", StringComparison.Ordinal);
            else if (s.Split(',').Length == 2)
                s = s.Replace(',', '.');
            else
                return false;
        }

        // PlainNumber uses \d, which in .NET also matches non-Latin digits; ToAsciiDigits covered
        // Arabic/Persian, so anything else that is still non-ASCII is rejected here.
        if (!PlainNumber().IsMatch(s) || s.Any(c => c > '\u007F')) return false;
        return decimal.TryParse(
            s,
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture,
            out value);
    }

    /// <summary>The parsed value, or null when the text is not a number.</summary>
    public static decimal? ParseOrNull(string? text) =>
        TryParse(text, out var value) ? value : null;

    /// <summary>A typed number that is greater than zero (an area, a price); <paramref name="value"/> is 0 otherwise.</summary>
    /// <remarks>
    /// How it works: 1) reads the text with <see cref="TryParse"/> — Arabic/Persian digits, «٫» as the
    /// decimal point, thousands commas and unit suffixes (م² ر.س …) are all accepted. 2) Returns true only
    /// when that succeeded and the value is above zero.
    /// Edge cases: null, blank, non-numeric text, zero and negative numbers all return false. A rejected
    /// number is reset to 0 — <see cref="TryParse"/> would leave a parsed «-5» in <paramref name="value"/>,
    /// and callers (the survey fee area, the bourse area) must never read a value they were told is invalid.
    /// It exists so the two server checks of «an area must be > 0» share one rule instead of two copies.
    /// </remarks>
    public static bool TryParsePositive(string? text, out decimal value)
    {
        if (TryParse(text, out value) && value > 0m) return true;
        value = 0m;
        return false;
    }

    private static string StripWhitespace(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            if (!char.IsWhiteSpace(ch)) sb.Append(ch);
        }
        return sb.ToString();
    }
}
