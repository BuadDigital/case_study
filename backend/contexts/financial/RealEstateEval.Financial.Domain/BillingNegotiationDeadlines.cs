namespace RealEstateEval.Financial.Domain;

/// <summary>
/// E6 — مهلة التفاوض على التسعيرة المعترَض عليها (بنود البتّ 9–14):
/// عشرة أيام عمل (الأحد–الخميس، بتوقيت الرياض UTC+3) من دخول «معترض»؛
/// تذكيران لا يتكرران (قبل الانقضاء بيومي عمل، وصباح يوم الانقضاء)؛
/// التصعيد بعد الانقضاء. لا احتساب للعطل الرسمية في v1.
/// </summary>
public static class BillingNegotiationDeadlines
{
    public const int NegotiationBusinessDays = 10;

 /// <summary>مفاتيح المراحل — تدخل في مفتاح التفرد وسجل الإرسال.</summary>
    public const string StageReminderTwoDays = "reminder-2d";
    public const string StageReminderDeadlineDay = "reminder-0d";
    public const string StageEscalation = "escalation";

    private static readonly TimeSpan RiyadhOffset = TimeSpan.FromHours(3);
 // نهاية يوم العمل 17:00 — نفس عرف مهلة التسليم في my-task-row.
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

 /// <summary>المهلة: عشرة أيام عمل من يوم الدخول، تنقضي 17:00 بتوقيت الرياض.</summary>
    public static DateTime DeadlineFromUtc(DateTime enteredDisputedUtc) =>
        RiyadhToUtc(
            AddBusinessDays(ToRiyadhDate(enteredDisputedUtc), NegotiationBusinessDays),
            EndOfBusinessDay);

 /// <summary>تذكير أول: 09:00 بتوقيت الرياض قبل يوم الانقضاء بيومي عمل.</summary>
    public static DateTime ReminderTwoDaysUtc(DateTime deadlineUtc) =>
        RiyadhToUtc(
            SubtractBusinessDays(ToRiyadhDate(deadlineUtc), 2),
            MorningReminderTime);

 /// <summary>تذكير ثانٍ: صباح يوم الانقضاء 09:00 بتوقيت الرياض.</summary>
    public static DateTime ReminderDeadlineDayUtc(DateTime deadlineUtc) =>
        RiyadhToUtc(ToRiyadhDate(deadlineUtc), MorningReminderTime);

 /// <summary>المراحل المستحقة الآن ولم تُرسل بعد، بترتيب الاستحقاق.</summary>
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

 /// <summary>مفتاح التفرد (بند 14) — ثابت لكل (بند × مرحلة × مهلة).</summary>
    public static string SourceEventKey(Guid ledgerId, string stage, DateTime deadlineUtc) =>
        $"billing-negotiation:{ledgerId:N}:{stage}:{deadlineUtc:O}";
}
