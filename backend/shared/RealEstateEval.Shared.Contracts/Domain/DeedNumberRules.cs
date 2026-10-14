using System.Text;

namespace RealEstateEval.Domain;

/// <summary>
/// One deed / registration number, however it was typed: trims, maps Arabic-Indic digits to ASCII
/// and strips separators, so "123456", "123-456" and "١٢٣٤٥٦" are the same deed — for the
/// duplicate-deed check, the prior-survey lookup and every exact deed match (case study, operations).
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

    /// <summary>Same deed once normalised; a blank (or separators-only) number matches nothing.</summary>
    public static bool EqualsNormalized(string? a, string? b)
    {
        var left = Normalize(a);
        return left.Length > 0
            && string.Equals(left, Normalize(b), StringComparison.OrdinalIgnoreCase);
    }

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
 // Probe Eastern Arabic-Indic forms so DB rows with Eastern digits still match.
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
