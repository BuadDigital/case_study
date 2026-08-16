namespace RealEstateEval.Domain;

/// <summary>
/// The kind of workflow task. A case-study parent owns one child per assigned party.
/// Persisted as the wire string (see <see cref="WorkflowTaskKindValues"/>) so existing
/// rows and the shell contract keep working.
/// </summary>
public enum WorkflowTaskKind
{
    CaseStudyProperty = 0,
 /// <summary>Legacy only — no longer spawned; government-reviewer works via court visits.</summary>
    GovernmentReview = 1,
 /// <summary>Legacy only — no longer spawned or shown as a product role.</summary>
    ValuationCoordination = 2,
    FieldInspection = 3,
    PropertyAppraisal = 4,
    EngineeringSurvey = 5,
}

/// <summary>
/// Phase of a case-study parent task. Party child tasks are created in
/// <see cref="Done"/> because they carry no phase of their own.
/// </summary>
public enum WorkflowTaskPhase
{
    Enfath = 0,
    Bourse = 1,
    Distribution = 2,
    CaseStudy = 3,
    Obstruction = 4,
    Done = 5,
}

public enum WorkflowTaskStatus
{
    Open = 0,
    Completed = 1,
    Cancelled = 2,
    Blocked = 3,
}

/// <summary>
/// Wire/database strings for <see cref="WorkflowTaskKind"/>. The constants are the exact
/// values already stored in WorkflowTasks.Kind and returned to the shell.
/// </summary>
public static class WorkflowTaskKindValues
{
    public const string CaseStudyProperty = "case-study-property";
 /// <summary>Legacy wire value — kept for existing DB rows; not spawned.</summary>
    public const string GovernmentReview = "government-review";
    public const string ValuationCoordination = "valuation-coordination";
    public const string FieldInspection = "field-inspection";
    public const string PropertyAppraisal = "property-appraisal";
    public const string EngineeringSurvey = "engineering-survey";
 /// <summary>Ops court-visit fee charges (أتعاب الزيارة) — party-billing ready/statement kind.</summary>
    public const string CourtVisit = "court-visit";

 /// <summary>Party kinds that may still be spawned as children of a case-study parent.</summary>
    public static readonly IReadOnlyList<WorkflowTaskKind> PartyKinds =
    [
        WorkflowTaskKind.FieldInspection,
        WorkflowTaskKind.PropertyAppraisal,
        WorkflowTaskKind.EngineeringSurvey,
    ];

    public static string ToDbValue(this WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.GovernmentReview => GovernmentReview,
        WorkflowTaskKind.ValuationCoordination => ValuationCoordination,
        WorkflowTaskKind.FieldInspection => FieldInspection,
        WorkflowTaskKind.PropertyAppraisal => PropertyAppraisal,
        WorkflowTaskKind.EngineeringSurvey => EngineeringSurvey,
        _ => CaseStudyProperty,
    };

    public static bool TryParse(string? value, out WorkflowTaskKind kind)
    {
        switch (value?.Trim())
        {
            case CaseStudyProperty: kind = WorkflowTaskKind.CaseStudyProperty; return true;
            case GovernmentReview: kind = WorkflowTaskKind.GovernmentReview; return true;
            case ValuationCoordination: kind = WorkflowTaskKind.ValuationCoordination; return true;
            case FieldInspection: kind = WorkflowTaskKind.FieldInspection; return true;
            case PropertyAppraisal: kind = WorkflowTaskKind.PropertyAppraisal; return true;
            case EngineeringSurvey: kind = WorkflowTaskKind.EngineeringSurvey; return true;
            default: kind = WorkflowTaskKind.CaseStudyProperty; return false;
        }
    }

 /// <summary>
 /// Lenient read path: unrecognised legacy values fall back to the parent kind rather than
 /// throwing, so a stray row cannot take the whole list endpoint down.
 /// </summary>
    public static WorkflowTaskKind Parse(string? value) =>
        TryParse(value, out var kind) ? kind : WorkflowTaskKind.CaseStudyProperty;

    public static bool IsParty(this WorkflowTaskKind kind) =>
        kind != WorkflowTaskKind.CaseStudyProperty;
}

/// <summary>Wire/database strings for <see cref="WorkflowTaskPhase"/>.</summary>
public static class WorkflowTaskPhaseValues
{
    public const string Enfath = "enfath";
    public const string Bourse = "bourse";
    public const string Distribution = "distribution";
    public const string CaseStudy = "case-study";
    public const string Obstruction = "obstruction";
    public const string Done = "done";

    public static string ToDbValue(this WorkflowTaskPhase phase) => phase switch
    {
        WorkflowTaskPhase.Bourse => Bourse,
        WorkflowTaskPhase.Distribution => Distribution,
        WorkflowTaskPhase.CaseStudy => CaseStudy,
        WorkflowTaskPhase.Obstruction => Obstruction,
        WorkflowTaskPhase.Done => Done,
        _ => Enfath,
    };

    public static bool TryParse(string? value, out WorkflowTaskPhase phase)
    {
        switch (value?.Trim())
        {
            case Enfath: phase = WorkflowTaskPhase.Enfath; return true;
            case Bourse: phase = WorkflowTaskPhase.Bourse; return true;
            case Distribution: phase = WorkflowTaskPhase.Distribution; return true;
            case CaseStudy: phase = WorkflowTaskPhase.CaseStudy; return true;
            case Obstruction: phase = WorkflowTaskPhase.Obstruction; return true;
            case Done: phase = WorkflowTaskPhase.Done; return true;
            default: phase = WorkflowTaskPhase.Enfath; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as the first phase.</summary>
    public static WorkflowTaskPhase Parse(string? value) =>
        TryParse(value, out var phase) ? phase : WorkflowTaskPhase.Enfath;

    public static WorkflowTaskPhase? ParseOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : Parse(value);

    public static string? ToDbValue(this WorkflowTaskPhase? phase) =>
        phase?.ToDbValue();
}

/// <summary>Wire/database strings for <see cref="WorkflowTaskStatus"/>.</summary>
public static class WorkflowTaskStatusValues
{
    public const string Open = "open";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";
    public const string Blocked = "blocked";

    public static string ToDbValue(this WorkflowTaskStatus status) => status switch
    {
        WorkflowTaskStatus.Completed => Completed,
        WorkflowTaskStatus.Cancelled => Cancelled,
        WorkflowTaskStatus.Blocked => Blocked,
        _ => Open,
    };

 /// <summary>Completed and cancelled tasks are closed — no further transition is allowed.</summary>
    public static bool IsTerminal(this WorkflowTaskStatus status) =>
        status is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled;

 /// <summary>Terminal check for wire values that have not been parsed yet.</summary>
    public static bool IsTerminalValue(string? status) =>
        TryParse(status, out var parsed) && parsed.IsTerminal();

    public static bool TryParse(string? value, out WorkflowTaskStatus status)
    {
        switch (value?.Trim())
        {
            case Open: status = WorkflowTaskStatus.Open; return true;
            case Completed: status = WorkflowTaskStatus.Completed; return true;
            case Cancelled: status = WorkflowTaskStatus.Cancelled; return true;
            case Blocked: status = WorkflowTaskStatus.Blocked; return true;
            default: status = WorkflowTaskStatus.Open; return false;
        }
    }

 /// <summary>Lenient read path; unrecognised legacy values read back as open.</summary>
    public static WorkflowTaskStatus Parse(string? value) =>
        TryParse(value, out var status) ? status : WorkflowTaskStatus.Open;
}