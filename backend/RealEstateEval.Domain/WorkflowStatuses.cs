namespace RealEstateEval.Domain;

// PropertyFailureStatus moved to RealEstateEval.Failures.Domain (A8).

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
