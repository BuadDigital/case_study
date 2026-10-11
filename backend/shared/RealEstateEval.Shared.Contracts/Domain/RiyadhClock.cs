namespace RealEstateEval.Domain;

/// <summary>
/// The business calendar is Riyadh's: "today", a report date, a validity window or a reference-number
/// year is the Riyadh day, never the UTC day (22:30Z on 8 Oct is already 9 Oct in Riyadh).
/// Saudi Arabia keeps UTC+3 all year (no daylight saving), so a fixed offset is exact.
/// Timestamps stay UTC — this is only for turning an instant into a calendar day/year and back.
/// </summary>
public static class RiyadhClock
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(3);

    /// <summary>Riyadh wall-clock time for a UTC instant (Kind = Unspecified).</summary>
    public static DateTime ToRiyadh(DateTime utc) =>
        DateTime.SpecifyKind(utc.Add(Offset), DateTimeKind.Unspecified);

    /// <summary>The UTC instant of a Riyadh wall-clock time.</summary>
    public static DateTime ToUtc(DateTime riyadhWallClock) =>
        DateTime.SpecifyKind(riyadhWallClock.Subtract(Offset), DateTimeKind.Utc);

    /// <summary>The UTC instant of a Riyadh calendar day at the given time of day.</summary>
    public static DateTime ToUtc(DateOnly riyadhDate, TimeSpan timeOfDay) =>
        ToUtc(riyadhDate.ToDateTime(TimeOnly.MinValue).Add(timeOfDay));

    /// <summary>The Riyadh calendar day a UTC instant falls on.</summary>
    public static DateOnly DateOf(DateTime utc) => DateOnly.FromDateTime(utc.Add(Offset));

    public static DateOnly Today(DateTime utcNow) => DateOf(utcNow);

    public static DateOnly Today(DateTimeOffset now) => DateOf(now.UtcDateTime);

    public static DateOnly Today(TimeProvider time) => Today(time.GetUtcNow());

    /// <summary>Gregorian year, Riyadh time — year boundaries follow the local business calendar.</summary>
    public static int Year(DateTime utcNow) => utcNow.Add(Offset).Year;

    public static int Year(DateTimeOffset now) => Year(now.UtcDateTime);

    public static int Year(TimeProvider time) => Year(time.GetUtcNow());
}
