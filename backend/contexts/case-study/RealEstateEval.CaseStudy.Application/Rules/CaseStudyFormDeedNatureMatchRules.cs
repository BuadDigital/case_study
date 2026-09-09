using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Deed↔nature match gate on case-study form save and submit.
/// Draft saves allow Unset; unknown tokens are rejected; فروق/تعذر need notes.
/// Submitting the case-study report for a traditional deed requires matched.
/// </summary>
public static class CaseStudyFormDeedNatureMatchRules
{
    public const string SubmitBlockedAr =
        "بوابة المطابقة: لا يُرفع تقرير دراسة الحالة لصك تقليدي إلا بعد مخرج مطابق — الفروق والتعذر مسار تعذر.";

    public static Dictionary<string, string>? ValidateForSave(
        string? outcome,
        string? notes)
    {
        var matchOutcome = (outcome ?? "").Trim().ToLowerInvariant();
        // IsKnown includes Unset — draft-friendly; matched is for submit / valuation.
        if (!DeedNatureMatchOutcomes.IsKnown(matchOutcome))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchOutcome"] = "مخرج المطابقة غير معروف",
            };
        }

        if (DeedNatureMatchOutcomes.RequiresNotes(matchOutcome)
            && string.IsNullOrWhiteSpace(notes))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchNotes"] = "ملاحظات المطابقة إلزامية عند «فروق» أو «مرشح تعذر»",
            };
        }

        return null;
    }

    /// <summary>
    /// Specialist report submit. Registered title skips. Traditional needs matched.
    /// </summary>
    public static Dictionary<string, string>? ValidateForSubmit(
        string? outcome,
        string? notes,
        DeedKind deedKind)
    {
        var saveErrors = ValidateForSave(outcome, notes);
        if (saveErrors is not null)
            return saveErrors;

        if (!DeedKindRules.AllowsCaseStudyReport(deedKind, outcome))
        {
            return new Dictionary<string, string>
            {
                ["_"] = SubmitBlockedAr,
            };
        }

        return null;
    }
}
