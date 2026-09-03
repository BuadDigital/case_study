namespace RealEstateEval.Financial.Domain;

/// <summary>
/// E6 — negotiation deadline for an objected fee quote (decision bits 9–14):
/// ten business days (Sun–Thu, Riyadh UTC+3) from entering “objected”;
/// two one-shot reminders (two business days before expiry, and morning of expiry day);
/// escalate after expiry. Official holidays are not counted in v1.
/// </summary>
public static class BillingNegotiationDeadlines
{
    public const int NegotiationBusinessDays = 10;

 /// <summary>Phase keys — enter into the uniqueness key and transmission register.</summary>
    public const string StageReminderTwoDays = "reminder-2d";
    public const string StageReminderDeadlineDay = "reminder-0d";
    public const string StageEscalation = "escalation";

    private static readonly TimeSpan RiyadhOffset = TimeSpan.FromHours(3);
 // End of the working day 17:00 — the same as the delivery deadline specified in my-task-row.
    private static readonly TimeSpan EndOfBusinessDay = TimeSpan.FromHours(17);
    private static readonly TimeSpan MorningReminderTime = TimeSpan.FromHours(9);

    private static bool IsBusinessDay(DateOnly date) =>
        date.DayOfWeek is not (DayOfWeek.Friday or DayOfWeek.Saturday);

    private static DateOnly AddBusinessDays(DateOnly start, int days)
    {
        var current = start;
        var remaining = days;
        while (remaining > 0)
        {
            current = current.AddDays(1);
            if (IsBusinessDay(current)) remaining--;
        }
        return current;
    }

    private static DateOnly SubtractBusinessDays(DateOnly start, int days)
    {
        var current = start;
        var remaining = days;
        while (remaining > 0)
        {
            current = current.AddDays(-1);
            if (IsBusinessDay(current)) remaining--;
        }
        return current;
    }

    private static DateOnly ToRiyadhDate(DateTime utc) =>
        DateOnly.FromDateTime(utc.Add(RiyadhOffset));

    private static DateTime RiyadhToUtc(DateOnly date, TimeSpan timeOfDay) =>
        DateTime.SpecifyKind(
            date.ToDateTime(TimeOnly.MinValue).Add(timeOfDay).Subtract(RiyadhOffset),
            DateTimeKind.Utc);

 /// <summary>Deadline: Ten working days from the day of entry, ending at 17:00 Riyadh time.</summary>
    public static DateTime DeadlineFromUtc(DateTime enteredDisputedUtc) =>
        RiyadhToUtc(
            AddBusinessDays(ToRiyadhDate(enteredDisputedUtc), NegotiationBusinessDays),
            EndOfBusinessDay);

 /// <summary>First reminder: 09:00 Riyadh time, two business days before the expiration day.</summary>
    public static DateTime ReminderTwoDaysUtc(DateTime deadlineUtc) =>
        RiyadhToUtc(
            SubtractBusinessDays(ToRiyadhDate(deadlineUtc), 2),
            MorningReminderTime);

 /// <summary>Second reminder: The morning of the expiration day is 09:00 Riyadh time.</summary>
    public static DateTime ReminderDeadlineDayUtc(DateTime deadlineUtc) =>
        RiyadhToUtc(ToRiyadhDate(deadlineUtc), MorningReminderTime);

 /// <summary>Milestones that are due now but not yet sent, in order of due.</summary>
    public static IReadOnlyList<string> DueStages(
        DateTime deadlineUtc,
        DateTime nowUtc,
        string? notifiedStagesCsv)
    {
        var notified = new HashSet<string>(
            (notifiedStagesCsv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries
                | StringSplitOptions.TrimEntries),
            StringComparer.Ordinal);

        var due = new List<string>(3);
        if (nowUtc >= ReminderTwoDaysUtc(deadlineUtc)
            && nowUtc < deadlineUtc
            && !notified.Contains(StageReminderTwoDays))
        {
            due.Add(StageReminderTwoDays);
        }
        if (nowUtc >= ReminderDeadlineDayUtc(deadlineUtc)
            && nowUtc < deadlineUtc
            && !notified.Contains(StageReminderDeadlineDay))
        {
            due.Add(StageReminderDeadlineDay);
        }
        if (nowUtc >= deadlineUtc && !notified.Contains(StageEscalation))
        {
            due.Add(StageEscalation);
        }
        return due;
    }

    public static string AppendNotifiedStage(string? notifiedStagesCsv, string stage)
    {
        var existing = (notifiedStagesCsv ?? "").Split(
            ',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (existing.Contains(stage, StringComparer.Ordinal)) return notifiedStagesCsv ?? "";
        return existing.Length == 0 ? stage : $"{string.Join(',', existing)},{stage}";
    }

 /// <summary>Unique key (item 14) — constant for each (item x phase x timeout).</summary>
    public static string SourceEventKey(Guid ledgerId, string stage, DateTime deadlineUtc) =>
        $"billing-negotiation:{ledgerId:N}:{stage}:{deadlineUtc:O}";
}
