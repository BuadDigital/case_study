namespace RealEstateEval.Failures.Domain;

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

 /// <summary>Arabic label for the status — previously duplicated in failures and case-study contexts.</summary>
    public static string LabelAr(string status) => status switch
    {
        Internal => "داخلي",
        Review => "قيد المراجعة",
        Approved => "معتمد",
        Returned => "مُعاد",
        Resolved => "محلول",
        Suspended => "معلق",
        _ => status,
    };
}
