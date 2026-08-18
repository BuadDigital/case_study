namespace RealEstateEval.Domain;

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
