namespace RealEstateEval.Domain;

/// <summary>
/// The three sub-roles a case specialist («أخصائي دراسة الحالة») may hold (Omar's ruling 2026-11-02):
/// coordination («التنسيق»), property study («دراسة العقار») and review + approval + Enfaz upload
/// («المراجعة والاعتماد والرفع»). A specialist holds one or more; other roles hold none.
/// </summary>
/// <remarks>
/// How it works: the wire vocabulary is the lower-case words below (JWT claim <c>subRole</c>, DTO
/// lists, the frontend); the identity store keeps them as bit flags (coordination = 1, study = 2,
/// review = 4) in one integer column, converted by <see cref="ToFlags"/> / <see cref="FromFlags"/>.
/// Edge cases: unknown words are ignored by <see cref="ToFlags"/> (validators reject them first);
/// flags outside 1–7 keep only the known bits; the order of <see cref="FromFlags"/> is always
/// coordination, study, review.
/// </remarks>
public static class CaseSpecialistSubRoles
{
    public const string Coordination = "coordination";
    public const string Study = "study";
    public const string Review = "review";

    /// <summary>Claim type carrying one sub-role per claim in the access token.</summary>
    public const string ClaimType = "subRole";

    public const int CoordinationFlag = 1;
    public const int StudyFlag = 2;
    public const int ReviewFlag = 4;
    public const int AllFlags = CoordinationFlag | StudyFlag | ReviewFlag;

    public static readonly IReadOnlyList<string> All = [Coordination, Study, Review];

    /// <summary>The flag bit of one sub-role word; 0 for an unknown word.</summary>
    public static int FlagOf(string? subRole) => Normalize(subRole) switch
    {
        Coordination => CoordinationFlag,
        Study => StudyFlag,
        Review => ReviewFlag,
        _ => 0,
    };

    public static bool IsKnown(string? subRole) => FlagOf(subRole) != 0;

    /// <summary>Folds sub-role words into the stored flags (unknown words add nothing).</summary>
    public static int ToFlags(IEnumerable<string>? subRoles) =>
        subRoles?.Aggregate(0, (flags, s) => flags | FlagOf(s)) ?? 0;

    /// <summary>The words of the stored flags, in the fixed order coordination, study, review.</summary>
    public static IReadOnlyList<string> FromFlags(int flags) =>
        All.Where(s => (flags & FlagOf(s)) != 0).ToList();

    public static string LabelAr(string? subRole) => Normalize(subRole) switch
    {
        Coordination => "التنسيق",
        Study => "دراسة العقار",
        Review => "المراجعة والاعتماد والرفع",
        _ => "",
    };

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
