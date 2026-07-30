namespace RealEstateEval.Application;

public static class PartyFeePricingCategories
{
    public const string EngineeringSurvey = "engineering-survey";
    public const string GovernmentReview = "government-review";
    public const string FieldInspector = "field-inspector";

    public static readonly string[] All =
    [
        EngineeringSurvey,
        GovernmentReview,
        FieldInspector,
    ];

    public static bool IsValid(string? value) =>
        value is EngineeringSurvey or GovernmentReview or FieldInspector;

    /// <summary>
    /// There is deliberately no lenient normaliser. Coercing an unknown value to a default silently
    /// pointed callers at the engineering-survey table — reads returned the wrong rates and a create
    /// landed in the wrong category, both without a word.
    /// </summary>
    public static string Require(string? value) =>
        IsValid(value)
            ? value!
            : throw new ArgumentException(InvalidMessage(value), nameof(value));

    public static string InvalidMessage(string? value) =>
        $"تصنيف التسعير «{value}» غير معروف. المسموح: {string.Join(" · ", All)}.";
}
