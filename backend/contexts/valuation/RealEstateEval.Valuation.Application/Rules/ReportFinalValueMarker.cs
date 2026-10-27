// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Value New file — approval reads data-final-value from the report copy's final-value banner and
//          refuses a copy without it or whose value is more than 0.5 SAR off the computed final value.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using System.Globalization;
using System.Text.RegularExpressions;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// The approved report copy is HTML the browser built. Its final-value banner carries the exact
/// number as <c>data-final-value</c>, so approval can refuse a copy whose value is not the one the
/// system computed — a stale or edited copy used to freeze as the official report.
/// </summary>
public static partial class ReportFinalValueMarker
{
    public const string MissingAr =
        "نسخة التقرير لا تحمل القيمة النهائية المحتسبة — حدّث صفحة التقرير ثم أعد الاعتماد.";

    /// <summary>Within half a riyal: the banner and the server round the same value.</summary>
    private const decimal Tolerance = 0.5m;

    public static bool TryRead(string html, out decimal value)
    {
        value = 0m;
        var match = MarkerRegex().Match(html ?? "");
        return match.Success
            && decimal.TryParse(match.Groups["value"].Value, NumberStyles.Number, CultureInfo.InvariantCulture, out value);
    }

    /// <summary>Null when the copy states the computed final value; otherwise the Arabic refusal.</summary>
    public static string? Check(string html, decimal computedFinalValue)
    {
        if (!TryRead(html, out var stated)) return MissingAr;
        if (Math.Abs(stated - computedFinalValue) <= Tolerance) return null;
        return $"القيمة النهائية في نسخة التقرير ({stated:#,0.##}) لا تطابق القيمة المحتسبة في النظام ({computedFinalValue:#,0.##}) — حدّث التقرير ثم أعد الاعتماد.";
    }

    [GeneratedRegex(@"data-final-value=""(?<value>-?[0-9]+(?:\.[0-9]+)?)""", RegexOptions.CultureInvariant)]
    private static partial Regex MarkerRegex();
}
