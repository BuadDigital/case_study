namespace RealEstateEval.Application;

public static class PartyFeePricingCategories
{
    public const string EngineeringSurvey = "engineering-survey";
    public const string GovernmentReview = "government-review";
    public const string FieldInspector = "field-inspector";

    public static bool IsValid(string? value) =>
        value is EngineeringSurvey or GovernmentReview or FieldInspector;

    public static string Normalize(string? value) =>
        IsValid(value) ? value! : EngineeringSurvey;
}
