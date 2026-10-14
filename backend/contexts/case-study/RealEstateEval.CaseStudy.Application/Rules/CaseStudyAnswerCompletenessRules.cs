using System.Text.Json;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The case-study question bank: how many questions each section has. Answer keys are
/// <c>&lt;section&gt;_&lt;index&gt;</c> with a zero-based index (<c>deed_0</c> … <c>deed_10</c>) and
/// match <c>^(deed|survey|comp|occ|extra)_\d+$</c>. Mirrors the frontend catalogue
/// (<c>property-fields-catalog.ts</c>, groups <c>case-study-*</c>); a drift test pins the two.
/// </summary>
public static class CaseStudyQuestionBank
{
    public const int DeedCount = 11;
    public const int SurveyCount = 7;
    public const int CompCount = 9;
    public const int OccCount = 6;
    public const int ExtraCount = 4;

    /// <summary>
    /// The key the answers map uses for the per-question notes object. It rides inside
    /// <c>answers</c> but is NOT a question and never counts toward completeness.
    /// </summary>
    public const string AnswerNotesKey = "__answerNotes";

    /// <summary>Sections in wizard order with their question counts.</summary>
    public static readonly IReadOnlyList<(string Section, int Count)> Sections =
    [
        ("deed", DeedCount),
        ("survey", SurveyCount),
        ("comp", CompCount),
        ("occ", OccCount),
        ("extra", ExtraCount),
    ];

    public static int TotalCount => Sections.Sum(s => s.Count);

    /// <summary>Every question key of the bank, in wizard order.</summary>
    public static IReadOnlyList<string> AllKeys { get; } =
        Sections.SelectMany(s => Enumerable.Range(0, s.Count).Select(i => $"{s.Section}_{i}")).ToList();

    private static readonly Dictionary<string, int> KeyOrder = AllKeys
        .Select((key, index) => (key, index))
        .ToDictionary(x => x.key, x => x.index, StringComparer.Ordinal);

    /// <summary>True when <paramref name="key"/> is a question of the bank (not a stale or foreign key).</summary>
    public static bool IsQuestionKey(string? key) => key is not null && KeyOrder.ContainsKey(key);

    /// <summary>Position of a bank key in wizard order, for stable sorting; int.MaxValue for foreign keys.</summary>
    public static int Order(string key) =>
        KeyOrder.TryGetValue(key, out var index) ? index : int.MaxValue;
}

/// <summary>
/// The 100% completeness rule for issuing a case-study report, decided server-side from the
/// answers the client sends with the issue request (its final state, not the stored row) and the
/// live info-roles matrix. Required = every bank question that at least one party holds a real
/// role on (the questions the specialist's wizard shows); answered = «A», «B» or «NA». It fails
/// CLOSED: no matrix, or a matrix with no real role, never counts as «nothing to answer».
/// </summary>
public static class CaseStudyAnswerCompletenessRules
{
    public const string AnswersKey = "answers";
    public const string MissingQuestionKeysKey = "missingQuestionKeys";

    public const string MatrixUnavailableAr =
        "تعذّر قراءة مصفوفة أدوار الأسئلة — لا يمكن التحقق من اكتمال الإجابات الآن، أعد المحاولة بعد قليل";

    public const string MatrixEmptyAr =
        "مصفوفة أدوار الأسئلة غير مضبوطة (لا سؤال له دور) — اطلب من مدير النظام ضبطها قبل إصدار التقرير";

    public sealed record Result(
        int Required,
        int Answered,
        IReadOnlyList<string> MissingKeys,
        string? FailureAr)
    {
        public bool Complete => FailureAr is null && MissingKeys.Count == 0;
    }

    /// <summary>The same notion as the frontend <c>isAnswered</c>: exactly «A», «B» or «NA».</summary>
    public static bool IsAnswered(object? value)
    {
        var text = value switch
        {
            null => null,
            string s => s,
            JsonElement { ValueKind: JsonValueKind.String } el => el.GetString(),
            _ => null,
        };
        return text is "A" or "B" or "NA";
    }

    /// <param name="matrix">Question key → party ids with a real role; null when unreadable.</param>
    /// <param name="answers">The answers map carried by the issue request (may hold <see cref="CaseStudyQuestionBank.AnswerNotesKey"/>).</param>
    public static Result Evaluate(
        IReadOnlyDictionary<string, IReadOnlyCollection<string>>? matrix,
        IReadOnlyDictionary<string, object?>? answers)
    {
        if (matrix is null)
            return new Result(0, 0, [], MatrixUnavailableAr);

        var required = matrix
            .Where(row => CaseStudyQuestionBank.IsQuestionKey(row.Key)
                && row.Value is { Count: > 0 } parties
                && parties.Any(p => !string.IsNullOrWhiteSpace(p)))
            .Select(row => row.Key)
            .OrderBy(CaseStudyQuestionBank.Order)
            .ToList();
        if (required.Count == 0)
            return new Result(0, 0, [], MatrixEmptyAr);

        var missing = required
            .Where(key => answers is null
                || !answers.TryGetValue(key, out var value)
                || !IsAnswered(value))
            .ToList();

        return new Result(required.Count, required.Count - missing.Count, missing, null);
    }

    /// <summary>The field-errors payload for an incomplete result, or null when complete.</summary>
    public static Dictionary<string, string>? ToErrors(Result result)
    {
        if (result.FailureAr is not null)
            return new Dictionary<string, string> { [AnswersKey] = result.FailureAr };

        if (result.Complete) return null;

        return new Dictionary<string, string>
        {
            [AnswersKey] = $"أسئلة ناقصة: {result.MissingKeys.Count} من {result.Required}",
            [MissingQuestionKeysKey] = string.Join(",", result.MissingKeys),
        };
    }
}
