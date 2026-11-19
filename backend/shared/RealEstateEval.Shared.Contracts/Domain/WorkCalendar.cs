namespace RealEstateEval.Domain;

/// <summary>
/// The working week as minutes: Sunday–Thursday, 08:00–17:00 Riyadh (the same hours the due dates and
/// the operations reminders use). No break window and no holidays — breaks differ per person and are not
/// kept in the system (Omar 2026-11-18).
/// </summary>
public static class WorkCalendar
{
    public static readonly TimeSpan DayStart = TimeSpan.FromHours(8);
    public static readonly TimeSpan DayEnd = TimeSpan.FromHours(17);

    /// <summary>Sunday to Thursday.</summary>
    public static bool IsWorkDay(DateOnly day) =>
        day.DayOfWeek is >= DayOfWeek.Sunday and <= DayOfWeek.Thursday;

    /// <summary>The UTC instant <paramref name="minutes"/> working minutes after <paramref name="fromUtc"/>.</summary>
    /// <remarks>
    /// How it works: walks Riyadh working days; time before the day starts counts from 08:00, time after
    /// 17:00 or on Friday/Saturday counts from the next working day's 08:00. Within a day the remaining
    /// minutes are added until 17:00, the rest carries to the next working day.
    /// Edge cases: zero or negative minutes → the next working instant at or after <paramref name="fromUtc"/>
    /// (a request sent at night starts counting when work starts).
    /// </remarks>
    public static DateTime AddWorkingMinutes(DateTime fromUtc, int minutes)
    {
        var remaining = TimeSpan.FromMinutes(Math.Max(0, minutes));
        var local = RiyadhClock.ToRiyadh(DateTime.SpecifyKind(fromUtc, DateTimeKind.Utc));
        var day = DateOnly.FromDateTime(local);
        var time = local.TimeOfDay;
        while (true)
        {
            if (IsWorkDay(day) && time < DayEnd)
            {
                if (time < DayStart) time = DayStart;
                var left = DayEnd - time;
                if (remaining <= left)
                    return RiyadhClock.ToUtc(day, time + remaining);
                remaining -= left;
            }
            day = day.AddDays(1);
            time = DayStart;
        }
    }

    /// <summary>
    /// Whether <paramref name="nowUtc"/> is within the last <paramref name="minutesBeforeEnd"/> minutes of a
    /// working day (the end-of-day reminder window), and that day.
    /// </summary>
    public static (bool Within, DateOnly Day) IsNearDayEnd(DateTime nowUtc, int minutesBeforeEnd)
    {
        var local = RiyadhClock.ToRiyadh(DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc));
        var day = DateOnly.FromDateTime(local);
        var time = local.TimeOfDay;
        var within = IsWorkDay(day)
                     && time < DayEnd
                     && time >= DayEnd - TimeSpan.FromMinutes(minutesBeforeEnd);
        return (within, day);
    }
}
