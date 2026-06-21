namespace RealEstateEval.Domain;

public static class WorkflowTaskStatus
{
    public const string Open = "open";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";
    public const string Blocked = "blocked";

    public static bool IsTerminal(string? status) =>
        status is Completed or Cancelled;
}

public static class PropertyFailureStatus
{
    public const string Internal = "internal";
    public const string Review = "review";
    public const string Approved = "approved";
    public const string Returned = "returned";
    public const string Suspended = "suspended";
    public const string Resolved = "resolved";

    public static readonly HashSet<string> Active =
    [
        Internal, Review, Approved, Returned,
    ];

    public static bool IsActive(string status) =>
        status is not (Resolved or Suspended);
}

public static class EvaluatorRecallStatus
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
}

public static class PartyTaskSubmissionStatus
{
    public const string Draft = "draft";
    public const string Submitted = "submitted";
    public const string Reopened = "reopened";
}
