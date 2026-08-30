namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Business days (Sun–Thu). Receipt day counts as day 1 if within hours; after 17:00 or a holiday → starts next business day.
/// Day count is passed by assignment type (4 for execution/estates, 10 for private).
/// </summary>
public static class BusinessDueDateCalculator
{
    private const int WorkdayStartHour = 8;
    private const int WorkdayEndHour = 17;
    public const int DefaultBusinessDays = 4;
    public const int PrivateSectorBusinessDays = 10;

    public static DateOnly Compute(
        DateOnly receivedDate,
        string? receivedTime,
        int businessDays = DefaultBusinessDays)
    {
        var days = businessDays < 1 ? DefaultBusinessDays : businessDays;
        var received = ParseReceived(receivedDate, receivedTime);
        var effective = GetEffectiveStartDate(received);
        return AddBusinessDaysFromEffectiveStart(effective, days);
    }

    private static DateTime ParseReceived(DateOnly receivedDate, string? receivedTime)
    {
        var t = string.IsNullOrWhiteSpace(receivedTime) ? "10:00" : receivedTime.Trim();
        if (TimeOnly.TryParse(t, out var time))
            return receivedDate.ToDateTime(time);
        return receivedDate.ToDateTime(new TimeOnly(10, 0));
    }

    private static bool IsBusinessDay(DateTime d) =>
        d.DayOfWeek is >= DayOfWeek.Sunday and <= DayOfWeek.Thursday;

    private static bool IsWithinBusinessHours(DateTime d) =>
        d.Hour >= WorkdayStartHour && d.Hour < WorkdayEndHour;

    private static DateTime GetEffectiveStartDate(DateTime received)
    {
        if (IsBusinessDay(received) && IsWithinBusinessHours(received))
            return received.Date;

        var cursor = received;
        if (!IsBusinessDay(cursor) || received.Hour >= WorkdayEndHour)
            cursor = cursor.AddDays(1);

        while (!IsBusinessDay(cursor))
            cursor = cursor.AddDays(1);

        return cursor.Date;
    }

    private static DateOnly AddBusinessDaysFromEffectiveStart(DateTime start, int count)
    {
        var d = start.Date;
        var remaining = count;
        while (remaining > 0)
        {
            if (IsBusinessDay(d))
                remaining--;
            if (remaining > 0)
                d = d.AddDays(1);
        }
        return DateOnly.FromDateTime(d);
    }
}
