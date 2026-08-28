namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// قراءة طوابع ISO المخزنة نصياً — كانت منسوخة في خدمتي الجدول الزمني والمعاملات المعلقة.
/// القيم غير الموسومة UTC تُعاد بنوع Unspecified عمداً (سلوك تاريخي تعتمده الواجهات).
/// </summary>
internal static class IsoTimestamps
{
    public static DateTime? ParseUtc(string? value)
    {
        if (!DateTime.TryParse(
                value,
                null,
                System.Globalization.DateTimeStyles.RoundtripKind,
                out var parsed))
        {
            return null;
        }

        return parsed.Kind == DateTimeKind.Utc
            ? parsed
            : DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
    }
}
