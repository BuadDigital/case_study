namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Parses ISO timestamps stored as text — previously duplicated in timeline and pending-transaction services.
/// Untagged values are returned as Unspecified on purpose (historical behavior the UI relies on).
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
