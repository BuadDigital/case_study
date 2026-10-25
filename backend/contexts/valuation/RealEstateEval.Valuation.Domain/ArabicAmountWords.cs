namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Arabic amount words (tafqeet) for report display and field code 65167, with the number
/// grammar a reader expects:
/// <list type="bullet">
/// <item>1 / 2 of a scale: «ألف»، «ألفان» — the dual drops its nūn when the counted noun follows
/// directly: 2,000,000 «مليونا ريال», 200,000 «مائتا ألف», 2,000 «ألفا ريال».</item>
/// <item>3–10: plural genitive — «ثلاثة آلاف»، «عشرة ملايين».</item>
/// <item>11–99: singular accusative — «أحد عشر ألفًا» … but «ألف» before a directly following noun.</item>
/// <item>100s: singular genitive — «مائة ألف»، «مائتا ألف».</item>
/// <item>A compound count follows its last part: 103,000 «مائة وثلاثة آلاف»;
/// 101,000 «مائة ألف وألف», 102,000 «مائة ألف وألفان».</item>
/// <item>The riyal follows the same rule (masculine), the halala is feminine.</item>
/// </list>
/// Keep in step with apps/mfe-evaluator/src/lib/evaluator/arabic-amount-words.ts (same test table).
/// </summary>
public static class ArabicAmountWords
{
    private static readonly string[] Ones =
    [
        "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
        "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
        "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
    ];

    /// <summary>Feminine units for a feminine counted noun (هللة).</summary>
    private static readonly string[] OnesFeminine =
        ["", "واحدة", "اثنتان", "ثلاث", "أربع", "خمس", "ست", "سبع", "ثماني", "تسع", "عشر"];

    private static readonly string[] Tens =
        ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];

    private static readonly string[] Hundreds =
    [
        "", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة",
        "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
    ];

    private sealed record Noun(string One, string Dual, string DualConstruct, string Plural, string Accusative);

    private static readonly Noun Thousand = new("ألف", "ألفان", "ألفا", "آلاف", "ألفًا");
    private static readonly Noun Million = new("مليون", "مليونان", "مليونا", "ملايين", "مليونًا");
    private static readonly Noun Billion = new("مليار", "ملياران", "مليارا", "مليارات", "مليارًا");

    private static readonly (long Value, Noun Noun)[] Scales =
    [
        (1_000_000_000L, Billion),
        (1_000_000L, Million),
        (1_000L, Thousand),
    ];

    public static string AmountToArabicWords(decimal amount)
    {
        if (amount == 0m) return "صفر ريال سعودي";

        var negative = amount < 0m;
        var abs = Math.Abs(amount);
        var riyals = (long)Math.Floor(abs + 0.000000001m);
        var hallalas = (int)Math.Round((abs - riyals) * 100m, MidpointRounding.AwayFromZero);
        if (hallalas >= 100)
        {
            riyals += 1;
            hallalas = 0;
        }

        var parts = new List<string>();
        if (riyals > 0)
            parts.Add(RiyalsInWords(riyals));
        else if (hallalas == 0)
            parts.Add("صفر ريال سعودي");

        if (hallalas > 0)
            parts.Add(HalalasInWords(hallalas));

        var text = string.Join(" و", parts);
        return negative ? $"سالب {text}" : text;
    }

    /// <summary>Plain cardinal (no counted noun).</summary>
    public static string IntegerToArabicWords(long n)
    {
        if (n == 0) return "صفر";
        if (n < 0) return $"سالب {IntegerToArabicWords(-n)}";
        var (parts, rest) = ScaleParts(n);
        if (rest > 0) parts.Add(UnderThousand((int)rest));
        return string.Join(" و", parts);
    }

    private static string RiyalsInWords(long n)
    {
        if (n == 1) return "ريال سعودي واحد";
        if (n == 2) return "ريالان سعوديان";
        var (parts, restLong) = ScaleParts(n);
        var rest = (int)restLong;
        var r = rest % 100;
        if (rest == 0) return $"{string.Join(" و", parts)} ريال سعودي";
        if (rest > 100 && r is 1 or 2)
        {
            // 101 / 1,002 …: «مائة ريال سعودي وريال واحد» — 1 and 2 have no counted form.
            var head = string.Join(" و", parts.Append(UnderThousand(rest - r, construct: true)));
            return $"{head} ريال سعودي و{(r == 1 ? "ريال واحد" : "ريالان")}";
        }

        if (rest is 1 or 2)
            return $"{string.Join(" و", parts)} ريال سعودي و{(rest == 1 ? "ريال واحد" : "ريالان")}";

        var words = string.Join(" و", parts.Append(UnderThousand(rest, construct: r == 0)));
        if (r == 0) return $"{words} ريال سعودي";
        if (r <= 10) return $"{words} ريالات سعودية";
        return $"{words} ريالًا سعوديًا";
    }

    /// <summary>1–99 halalas — a feminine noun.</summary>
    private static string HalalasInWords(int h)
    {
        if (h == 1) return "هللة واحدة";
        if (h == 2) return "هللتان";
        if (h <= 10) return $"{OnesFeminine[h]} هللات";
        if (h == 11) return "إحدى عشرة هللةً";
        if (h == 12) return "اثنتا عشرة هللةً";
        if (h < 20) return $"{OnesFeminine[h % 10]} عشرة هللةً";
        var t = h / 10;
        var o = h % 10;
        var unit = o switch { 1 => "إحدى", 2 => "اثنتان", _ => OnesFeminine[o] };
        return $"{(o == 0 ? "" : $"{unit} و")}{Tens[t]} هللةً";
    }

    /// <summary>Scale words of <paramref name="n"/> and the part under 1000.</summary>
    private static (List<string> Parts, long Remainder) ScaleParts(long n)
    {
        var parts = new List<string>();
        var rem = n;
        foreach (var (value, noun) in Scales)
        {
            if (rem < value) continue;
            var count = rem / value;
            rem %= value;
            // Beyond 999 milliards (never a real valuation) the count is spelled plainly.
            parts.Add(count >= 1000
                ? $"{IntegerToArabicWords(count)} {noun.One}"
                : CountedScale((int)count, noun, last: rem == 0));
        }

        return (parts, rem);
    }

    /// <summary>
    /// <paramref name="count"/> (1–999) of a scale noun. <paramref name="last"/>: the counted noun
    /// (ريال) follows directly — duals take the construct form and 11–99 drop the tanwīn.
    /// </summary>
    private static string CountedScale(int count, Noun noun, bool last)
    {
        if (count == 1) return noun.One;
        if (count == 2) return last ? noun.DualConstruct : noun.Dual;
        var r = count % 100;
        if (count > 100 && r is 1 or 2)
        {
            var tail = r == 1 ? noun.One : last ? noun.DualConstruct : noun.Dual;
            return $"{UnderThousand(count - r, construct: true)} {noun.One} و{tail}";
        }

        if (r is >= 3 and <= 10) return $"{UnderThousand(count)} {noun.Plural}";
        if (r >= 11) return $"{UnderThousand(count)} {(last ? noun.One : noun.Accusative)}";
        return $"{UnderThousand(count, construct: true)} {noun.One}";
    }

    /// <summary>1–999; <paramref name="construct"/>: a noun follows directly, so a bare «مائتان» becomes «مائتا».</summary>
    private static string UnderThousand(int n, bool construct = false)
    {
        if (n < 100) return UnderHundred(n);
        var h = n / 100;
        var rest = n % 100;
        var head = h == 2 && construct && rest == 0 ? "مائتا" : Hundreds[h];
        if (rest == 0) return head;
        return $"{head} و{UnderHundred(rest)}";
    }

    private static string UnderHundred(int n)
    {
        if (n < 20) return Ones[n];
        var t = n / 10;
        var o = n % 10;
        if (o == 0) return Tens[t];
        return $"{Ones[o]} و{Tens[t]}";
    }
}
