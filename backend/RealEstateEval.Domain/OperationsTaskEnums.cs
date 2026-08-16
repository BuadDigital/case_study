namespace RealEstateEval.Domain;

/// <summary>
/// Operations task kind (طبقة المهام). Persisted as the wire string — see
/// <see cref="OperationsTaskTypeValues"/>.
/// </summary>
public enum OperationsTaskType
{
    General = 0,
    CourtVisit = 1,
    Reshoot = 2,
    FieldVisit = 3,
    Inquiry = 4,
}

/// <summary>What the operations task is linked to.</summary>
public enum OperationsTaskScope
{
    General = 0,
    Transaction = 1,
    WorkOrder = 2,
    Multi = 3,
}

public enum OperationsTaskStatus
{
    Created = 0,
    InProgress = 1,
    Paused = 2,
    Completed = 3,
    Cancelled = 4,
}

public enum OperationsTaskPriority
{
    High = 0,
    Medium = 1,
    Low = 2,
}

/// <summary>Court-visit close outcome (موقف المفاتيح لدى المحكمة).</summary>
public enum CourtVisitOutcomeKind
{
    Received = 0,
    OtherParty = 1,
    None = 2,
    Other = 3,
}

public static class OperationsTaskTypeValues
{
    public const string CourtVisit = "court_visit";
    public const string Reshoot = "reshoot";
    public const string FieldVisit = "field_visit";
    public const string Inquiry = "inquiry";
    public const string General = "general";

    public static string ToDbValue(this OperationsTaskType type) => type switch
    {
        OperationsTaskType.CourtVisit => CourtVisit,
        OperationsTaskType.Reshoot => Reshoot,
        OperationsTaskType.FieldVisit => FieldVisit,
        OperationsTaskType.Inquiry => Inquiry,
        _ => General,
    };

    public static bool TryParse(string? value, out OperationsTaskType type)
    {
        switch (value?.Trim())
        {
            case CourtVisit: type = OperationsTaskType.CourtVisit; return true;
            case Reshoot: type = OperationsTaskType.Reshoot; return true;
            case FieldVisit: type = OperationsTaskType.FieldVisit; return true;
            case Inquiry: type = OperationsTaskType.Inquiry; return true;
            case General: type = OperationsTaskType.General; return true;
            default: type = OperationsTaskType.General; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as general.</summary>
    public static OperationsTaskType Parse(string? value) =>
        TryParse(value, out var type) ? type : OperationsTaskType.General;
}

public static class OperationsTaskScopeValues
{
    public const string Transaction = "transaction";
    public const string WorkOrder = "work_order";
    public const string Multi = "multi";
    public const string General = "general";

 /// <summary>Contact-level scope inside a court-visit result, distinct from the task scope.</summary>
    public const string ContactPropertyScope = "property";

    public static string ToDbValue(this OperationsTaskScope scope) => scope switch
    {
        OperationsTaskScope.Transaction => Transaction,
        OperationsTaskScope.WorkOrder => WorkOrder,
        OperationsTaskScope.Multi => Multi,
        _ => General,
    };

    public static bool TryParse(string? value, out OperationsTaskScope scope)
    {
        switch (value?.Trim())
        {
            case Transaction: scope = OperationsTaskScope.Transaction; return true;
            case WorkOrder: scope = OperationsTaskScope.WorkOrder; return true;
            case Multi: scope = OperationsTaskScope.Multi; return true;
            case General: scope = OperationsTaskScope.General; return true;
            default: scope = OperationsTaskScope.General; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as general.</summary>
    public static OperationsTaskScope Parse(string? value) =>
        TryParse(value, out var scope) ? scope : OperationsTaskScope.General;
}

public static class OperationsTaskStatusValues
{
    public const string Created = "created";
    public const string InProgress = "in_progress";
    public const string Paused = "paused";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";

    public static string ToDbValue(this OperationsTaskStatus status) => status switch
    {
        OperationsTaskStatus.InProgress => InProgress,
        OperationsTaskStatus.Paused => Paused,
        OperationsTaskStatus.Completed => Completed,
        OperationsTaskStatus.Cancelled => Cancelled,
        _ => Created,
    };

    public static string? ToDbValue(this OperationsTaskStatus? status) => status?.ToDbValue();

 /// <summary>Completed and cancelled are final; nothing transitions out of them.</summary>
    public static bool IsTerminal(this OperationsTaskStatus status) =>
        status is OperationsTaskStatus.Completed or OperationsTaskStatus.Cancelled;

 /// <summary>Statuses that still accept reminders and status changes.</summary>
    public static bool IsActive(this OperationsTaskStatus status) =>
        status is OperationsTaskStatus.Created or OperationsTaskStatus.InProgress;

    public static bool TryParse(string? value, out OperationsTaskStatus status)
    {
        switch (value?.Trim())
        {
            case Created: status = OperationsTaskStatus.Created; return true;
            case InProgress: status = OperationsTaskStatus.InProgress; return true;
            case Paused: status = OperationsTaskStatus.Paused; return true;
            case Completed: status = OperationsTaskStatus.Completed; return true;
            case Cancelled: status = OperationsTaskStatus.Cancelled; return true;
            default: status = OperationsTaskStatus.Created; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as created.</summary>
    public static OperationsTaskStatus Parse(string? value) =>
        TryParse(value, out var status) ? status : OperationsTaskStatus.Created;

    public static OperationsTaskStatus? ParseOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : Parse(value);
}

public static class OperationsTaskPriorityValues
{
    public const string High = "high";
    public const string Medium = "medium";
    public const string Low = "low";

    public static string ToDbValue(this OperationsTaskPriority priority) => priority switch
    {
        OperationsTaskPriority.High => High,
        OperationsTaskPriority.Low => Low,
        _ => Medium,
    };

    public static string ToArabicLabel(this OperationsTaskPriority priority) => priority switch
    {
        OperationsTaskPriority.High => "عالية",
        OperationsTaskPriority.Low => "منخفضة",
        _ => "متوسطة",
    };

    public static bool TryParse(string? value, out OperationsTaskPriority priority)
    {
        switch (value?.Trim())
        {
            case High: priority = OperationsTaskPriority.High; return true;
            case Medium: priority = OperationsTaskPriority.Medium; return true;
            case Low: priority = OperationsTaskPriority.Low; return true;
            default: priority = OperationsTaskPriority.Medium; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as medium.</summary>
    public static OperationsTaskPriority Parse(string? value) =>
        TryParse(value, out var priority) ? priority : OperationsTaskPriority.Medium;
}

public static class CourtVisitOutcomeKindValues
{
    public const string Received = "received";
    public const string OtherParty = "other_party";
    public const string None = "none";
    public const string Other = "other";

    public static string ToDbValue(this CourtVisitOutcomeKind kind) => kind switch
    {
        CourtVisitOutcomeKind.Received => Received,
        CourtVisitOutcomeKind.OtherParty => OtherParty,
        CourtVisitOutcomeKind.None => None,
        _ => Other,
    };

    public static string ToArabicLabel(this CourtVisitOutcomeKind kind, string? other) => kind switch
    {
        CourtVisitOutcomeKind.Received => "استُلم ظرف مفاتيح",
        CourtVisitOutcomeKind.OtherParty => "الظرف عند طرف آخر",
        CourtVisitOutcomeKind.None => "لا توجد مفاتيح مسجلة لدى الدائرة",
        _ => string.IsNullOrWhiteSpace(other) ? "أخرى" : "أخرى — " + other.Trim(),
    };

    public static bool TryParse(string? value, out CourtVisitOutcomeKind kind)
    {
        switch (value?.Trim())
        {
            case Received: kind = CourtVisitOutcomeKind.Received; return true;
            case OtherParty: kind = CourtVisitOutcomeKind.OtherParty; return true;
            case None: kind = CourtVisitOutcomeKind.None; return true;
            case Other: kind = CourtVisitOutcomeKind.Other; return true;
            default: kind = CourtVisitOutcomeKind.Other; return false;
        }
    }
}
