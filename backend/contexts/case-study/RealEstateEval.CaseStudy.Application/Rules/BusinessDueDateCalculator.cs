namespace RealEstateEval.Application.Rules;

/// <summary>
/// أيام عمل (أحد–خميس). يوم الاستلام يوم 1 إن كان ضمن الدوام؛ بعد 17:00 أو عطلة → يبدأ من يوم العمل التالي.
/// عدد الأيام يُمرَّر حسب نوع الإسناد (4 تنفيذ/تركات، 10 خاص).
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
