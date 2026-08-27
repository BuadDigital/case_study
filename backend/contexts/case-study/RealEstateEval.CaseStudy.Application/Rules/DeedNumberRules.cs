using System.Text;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Normalizes deed / registration numbers for prior-lookup matching.
/// Trims, maps Arabic-Indic digits to ASCII, and strips separators.
/// </summary>
public static class DeedNumberRules
{
    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var s = raw.Trim();
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            if (ch is >= '٠' and <= '٩')
            {
                sb.Append((char)('0' + (ch - '٠')));
                continue;
            }

            if (ch is >= '۰' and <= '۹')
            {
                sb.Append((char)('0' + (ch - '۰')));
                continue;
            }

            if (char.IsWhiteSpace(ch)
                || ch is '-' or '_' or '/' or '\\' or '\u00A0' or '\u200f' or '\u200e')
            {
                continue;
            }

            sb.Append(ch);
        }

        return sb.ToString();
    }

    public static bool EqualsNormalized(string? a, string? b) =>
        string.Equals(Normalize(a), Normalize(b), StringComparison.OrdinalIgnoreCase);

 /// <summary>
 /// Variants suitable for SQL equality probes when the stored value may not be normalized.
 /// </summary>
    public static IReadOnlyList<string> MatchCandidates(string? raw)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var trimmed = (raw ?? "").Trim();
        if (trimmed.Length > 0) set.Add(trimmed);

        var n = Normalize(raw);
        if (n.Length > 0)
        {
            set.Add(n);
 // Probe Eastern Arabic-Indic forms so DB rows with ٠-٩ still match.
            set.Add(ToArabicIndic(n, eastern: false));
            set.Add(ToArabicIndic(n, eastern: true));
        }

        return set.Where(s => s.Length > 0).ToList();
    }

    private static string ToArabicIndic(string ascii, bool eastern)
    {
        var sb = new StringBuilder(ascii.Length);
        foreach (var ch in ascii)
        {
            if (ch is >= '0' and <= '9')
            {
                var baseDigit = eastern ? '۰' : '٠';
                sb.Append((char)(baseDigit + (ch - '0')));
            }
            else
            {
                sb.Append(ch);
            }
        }

        return sb.ToString();
    }
}
