namespace RealEstateEval.Valuation.Domain;

/// <summary>Arabic amount words (تفقيط) for report display and field code 65167.</summary>
public static class ArabicAmountWords
{
    private static readonly string[] Ones =
    [
        "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
        "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
        "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
    ];

    private static readonly string[] Tens =
        ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];

    private static readonly string[] Hundreds =
    [
        "", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة",
        "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
    ];

    public static string AmountToArabicWords(decimal amount)
    {
        if (amount == 0m) return "صفر ريال سعودي";

        var negative = amount < 0m;
        var abs = Math.Abs(amount);
        var riyals = (long)Math.Floor(abs + 0.000000001m);
        var hallalas = (int)Math.Round((abs - riyals) * 100m, MidpointRounding.AwayFromZero);
        if (hallalas == 100)
        {
            riyals += 1;
            hallalas = 0;
        }

        var parts = new List<string>();
        if (riyals > 0)
            parts.Add($"{IntegerToArabicWords(riyals)} ريال سعودي");
        else if (hallalas == 0)
            parts.Add("صفر ريال سعودي");

        if (hallalas > 0)
            parts.Add($"{IntegerToArabicWords(hallalas)} هللة");

        var text = string.Join(" و", parts);
        return negative ? $"سالب {text}" : text;
    }

    public static string IntegerToArabicWords(long n)
    {
        if (n == 0) return "صفر";
        if (n < 0) return $"سالب {IntegerToArabicWords(-n)}";

        var parts = new List<string>();
        long rem = n;

        AppendScale(parts, ref rem, 1_000_000_000, "مليار", "ملياران", "مليارات", "مليار");
        AppendScale(parts, ref rem, 1_000_000, "مليون", "مليونان", "ملايين", "مليون");
        AppendScale(parts, ref rem, 1_000, "ألف", "ألفان", "آلاف", "ألف");

        if (rem > 0)
            parts.Add(UnderThousand((int)rem));

        return string.Join(" و", parts);
    }

    private static void AppendScale(
        List<string> parts,
        ref long rem,
        long value,
        string one,
        string dual,
        string few,
        string many)
    {
        if (rem < value) return;
        var count = rem / value;
        rem %= value;
        parts.Add(ScaleLabel(count, one, dual, few, many));
    }

    private static string ScaleLabel(long count, string one, string dual, string few, string many)
    {
        if (count == 1) return one;
        if (count == 2) return dual;
        if (count is >= 3 and <= 10)
            return $"{UnderThousand((int)count)} {few}";
        return $"{UnderThousand((int)count)} {many}";
    }

    private static string UnderThousand(int n)
    {
        if (n < 100) return UnderHundred(n);
        var h = n / 100;
        var rest = n % 100;
        var head = Hundreds[h];
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
