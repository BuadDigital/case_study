namespace RealEstateEval.Application.Rules;

/// <summary>
/// Work-hours reminder cadence for operations tasks (Sun–Thu, 08:00–17:00 Asia/Riyadh).
/// Mirrors Case Study.html nextWorkHour / nextCheckpoint / nextWorkDayNoon.
/// </summary>
public static class OperationsTaskReminderCalculator
{
    public const int WorkStartHour = 8;
    public const int WorkEndHour = 17;
    public const int NoonHour = 12;

    private static readonly TimeZoneInfo RiyadhTz = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Arab Standard Time" : "Asia/Riyadh");

    /// <summary>Next reminder instant (UTC) after <paramref name="fromUtc"/> for the given priority.</summary>
    public static DateTime NextReminderUtc(string priority, DateTime fromUtc)
    {
        var utc = DateTime.SpecifyKind(fromUtc.ToUniversalTime(), DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, RiyadhTz);
        var p = string.IsNullOrWhiteSpace(priority) ? "medium" : priority.Trim().ToLowerInvariant();
        var nextLocal = p switch
        {
            "high" => NextWorkHour(local),
            "low" => NextWorkDayNoon(local),
            _ => NextCheckpoint(local),
        };
        return TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(nextLocal, DateTimeKind.Unspecified),
            RiyadhTz);
    }

    public static bool IsWorkDay(DateTime d) =>
        // Sunday–Thursday (Saudi week)
        d.DayOfWeek is >= DayOfWeek.Sunday and <= DayOfWeek.Thursday;

    /// <summary>Wall-clock time in the same calendar day as <paramref name="d"/> (unspecified kind).</summary>
    public static DateTime AtHourLocal(DateTime d, int hour) =>
        new(d.Year, d.Month, d.Day, hour, 0, 0, DateTimeKind.Unspecified);

    public static DateTime NextWorkDayNoon(DateTime ts)
    {
        var d = ts;
        do
        {
            d = d.AddDays(1);
        } while (!IsWorkDay(d));
        return AtHourLocal(d, NoonHour);
    }

    public static DateTime NextCheckpoint(DateTime ts)
    {
        var h = ts.Hour + ts.Minute / 60.0;
        if (IsWorkDay(ts))
        {
            if (h < NoonHour) return AtHourLocal(ts, NoonHour);
            if (h < WorkEndHour) return AtHourLocal(ts, WorkEndHour);
        }
        return NextWorkDayNoon(ts);
    }

    public static DateTime NextWorkHour(DateTime ts)
    {
        if (IsWorkDay(ts) && ts.Hour < WorkStartHour)
            return AtHourLocal(ts, WorkStartHour);

        var cand = new DateTime(ts.Year, ts.Month, ts.Day, ts.Hour, 0, 0, DateTimeKind.Unspecified)
            .AddHours(1);

        if (IsWorkDay(cand) && cand.Hour >= WorkStartHour && cand.Hour <= WorkEndHour)
            return cand;

        var nd = ts;
        do
        {
            nd = nd.AddDays(1);
        } while (!IsWorkDay(nd));
        return AtHourLocal(nd, WorkStartHour);
    }

    /// <summary>
    /// Instant (UTC) when a pause exceeds the one-workday limit from <paramref name="pausedAtUtc"/>.
    /// </summary>
    public static DateTime PauseLimitDeadlineUtc(DateTime pausedAtUtc)
    {
        var utc = DateTime.SpecifyKind(pausedAtUtc.ToUniversalTime(), DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, RiyadhTz);
        var nextLocal = NextWorkDaySameTime(local);
        return TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(nextLocal, DateTimeKind.Unspecified),
            RiyadhTz);
    }

    /// <summary>Same clock time on the next Saudi workday.</summary>
    public static DateTime NextWorkDaySameTime(DateTime localTs)
    {
        var d = localTs;
        do
        {
            d = d.AddDays(1);
        } while (!IsWorkDay(d));
        return new DateTime(
            d.Year, d.Month, d.Day,
            localTs.Hour, localTs.Minute, localTs.Second,
            DateTimeKind.Unspecified);
    }
}
