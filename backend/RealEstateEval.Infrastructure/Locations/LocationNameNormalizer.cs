using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace RealEstateEval.Infrastructure.Locations;

/// <summary>تطبيع أسماء المواقع للبحث — مطابق لمواصفة المناطق/المدن v2 §4.</summary>
public static partial class LocationNameNormalizer
{
    private static readonly Regex Diacritics = DiacriticsRegex();
    private static readonly Regex MultiSpace = MultiSpaceRegex();
    private static readonly Regex Prefixes = PrefixesRegex();

    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "";

        var s = input.Trim().Normalize(NormalizationForm.FormKC);
        s = Diacritics.Replace(s, "");
        s = s.Replace('\u0640', ' '); // tatweel

        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            sb.Append(ch switch
            {
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ؤ' => 'و',
                'ئ' => 'ي',
                'ة' => 'ه',
                'ى' => 'ي',
                _ => ch,
            });
        }

        s = sb.ToString();
        s = Prefixes.Replace(s, "");
        s = MultiSpace.Replace(s, " ").Trim();
        return s;
    }

    /// <summary>مسافة تحرير بسيطة للمقترحات المتشابهة.</summary>
    public static int EditDistance(string a, string b)
    {
        a ??= "";
        b ??= "";
        if (a == b) return 0;
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;

        var prev = new int[b.Length + 1];
        var cur = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++) prev[j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            cur[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                cur[j] = Math.Min(
                    Math.Min(cur[j - 1] + 1, prev[j] + 1),
                    prev[j - 1] + cost);
            }
            (prev, cur) = (cur, prev);
        }

        return prev[b.Length];
    }

    public static bool LooksLikeArabicName(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return false;
        var t = input.Trim();
        if (t.Length is < 2 or > 150) return false;
        if (char.IsDigit(t[0])) return false;
        foreach (var ch in t)
        {
            if (char.IsWhiteSpace(ch) || char.IsDigit(ch)) continue;
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat is UnicodeCategory.OtherLetter or UnicodeCategory.NonSpacingMark)
                continue;
            // Allow Arabic punctuation range roughly
            if (ch is >= '\u0600' and <= '\u06FF') continue;
            return false;
        }
        return true;
    }

    [GeneratedRegex(@"[\u064B-\u065F\u0670]", RegexOptions.CultureInvariant)]
    private static partial Regex DiacriticsRegex();

    [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant)]
    private static partial Regex MultiSpaceRegex();

    [GeneratedRegex(@"^\s*(محافظة|مدينة|مركز|حي)\s+", RegexOptions.CultureInvariant)]
    private static partial Regex PrefixesRegex();
}
