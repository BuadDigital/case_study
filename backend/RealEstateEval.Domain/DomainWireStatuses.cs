namespace RealEstateEval.Domain;

/// <summary>
/// Wire values for party work completion on inspector-fee and enfaz billing rows.
/// Derived from workflow tasks (not a stored enum on the ledger).
/// </summary>
public static class InspectorFeeWorkStatuses
{
    public const string Done = "done";
    public const string InProgress = "in_progress";
    public const string Cancelled = "cancelled";
}

/// <summary>Wire values for <see cref="CaseStudyForm.Status"/>.</summary>
public static class CaseStudyFormStatuses
{
    public const string New = "new";
    public const string Draft = "draft";
    public const string Submitted = "submitted";
    public const string Completed = "completed";
    public const string Done = "done";

    public static bool IsTerminal(string? status) =>
        status is Submitted or Completed or Done;
}

/// <summary>Government-review payload visitStatus wire values.</summary>
public static class GovernmentReviewVisitStatuses
{
    public const string Completed = "completed";
    public const string Blocked = "blocked";
}

/// <summary>Wire values for <see cref="PropertyKeyRecord.WorkflowStatus"/>.</summary>
public static class PropertyKeyWorkflowStatuses
{
    public const string Progress = "progress";
    public const string Done = "done";

    public static bool IsDone(string? status) =>
        string.Equals(status, Done, StringComparison.OrdinalIgnoreCase);
}

/// <summary>Gate + government-review payload <c>keysStatus</c> wire values.</summary>
public static class PropertyKeysStatuses
{
    public const string Pending = "pending";
    public const string Received = "received";
    public const string NotRequired = "not_required";
    public const string Blocked = "blocked";

    public static bool IsLegacyQueueStatus(string? status) =>
        status is Pending or Received;
}

/// <summary>Gate <c>keyHandedToInspector</c> wire values.</summary>
public static class PropertyKeyHandedValues
{
    public const string Yes = "yes";
    public const string No = "no";
}

/// <summary>Wire values for property-key gate <c>source</c>.</summary>
public static class PropertyKeyGateSources
{
    public const string Envelope = "envelope";
    public const string CourtAccess = "court_access";
    public const string Legacy = "legacy";
    public const string None = "none";
}

/// <summary>Wire values for property-list Survey/Val/Study tracks and Status.</summary>
public static class PropertyListRowStatuses
{
    public const string New = "new";
    public const string Progress = "progress";
    public const string Done = "done";
    public const string Fail = "fail";
    public const string Incomplete = "incomplete";
}

/// <summary>Wire values for property timeline event <c>tone</c>.</summary>
public static class PropertyTimelineTones
{
    public const string Done = "done";
    public const string Active = "active";
    public const string Warn = "warn";
    public const string Muted = "muted";

    public static string Normalize(string? tone) =>
        (tone ?? "").Trim().ToLowerInvariant() switch
        {
            Active => Active,
            Warn => Warn,
            Muted => Muted,
            _ => Done,
        };
}

/// <summary>Wire values for financial summary revenue-row Status chips.</summary>
public static class FinancialRevenueRowStatuses
{
    public const string Progress = "progress";
    public const string Done = "done";
}
