using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Deed↔nature match gate on case-study form save.
/// Draft saves allow Unset; unknown tokens are rejected; فروق/تعذر need notes.
/// Specialist submit completeness (chosen outcome) is enforced on the FE and by valuation issuance.
/// </summary>
public static class CaseStudyFormDeedNatureMatchRules
{
    public static Dictionary<string, string>? ValidateForSave(
        string? outcome,
        string? notes)
    {
        var matchOutcome = (outcome ?? "").Trim().ToLowerInvariant();
        // IsKnown includes Unset — draft-friendly; IsChosen is for submit / valuation.
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
}
