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
